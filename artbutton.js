/**
 * This class is used as a namespace for Show Art
 * static methods. It has no constructor.
 *
 * @namespace ShowArt
 */
class ShowArt {
	/** Register keybindings */
	static registerBindings() {
		game.keybindings.register("show-art-button", "token-open", {
			name: "TKNHAB.kebind.tokenImage.name",
			hint: game.i18n.localize("TKNHAB.kebind.tokenImage.hint"),
			editable: [{ key: "KeyZ", modifiers: ["Shift"] }],
			onDown: keybind => this.handleShowArt(keybind, false),
			reservedModifiers: ["Alt"]
		});

		game.keybindings.register("show-art-button", "actor-open", {
			name: "TKNHAB.kebind.actorImage.name",
			hint: game.i18n.localize("TKNHAB.kebind.actorImage.hint"),
			editable: [{ key: "KeyX", modifiers: ["Shift"] }],
			onDown: keybind => this.handleShowArt(keybind, true),
			reservedModifiers: ["Alt"]
		});
	}

	/** Handle keybindings */
	static handleShowArt(keybind, altImage) {
		canvas.activeLayer.controlled.forEach(object => {
			const { image, title } = this.getObjectData(object, altImage);
			if (!image) return;

			const pop = this.createImagePopup(image, title);
			if (!keybind.isAlt && game.user.isGM) pop.shareImage();
		});
	}

	/** Get appropriate data for any placeable object */
	static getObjectData(object, altImage) {
		switch (object.document.documentName) {
			case "Token": return this.getTokenData(object, altImage);
			case "Tile": return this.getTileData(object);
			default: return { image: null, title: "" };
		}
	}

	/** Get image + title for token */
	static getTokenData(token, altImage) {
		const actor = token.actor ?? this.getTokenActor(token.document);
		const images = this.getTokenImages(token.document, actor);
		const titles = this.getTokenTitles(token.document, actor);

		return {
			image: altImage ? images.actor : images.token,
			title: altImage ? titles.actor : titles.token
		};
	}

	/** Get image + title for tile */
	static getTileData(tile) {
		return {
			image: tile.document.texture?.src ?? tile.document.img,
			title: game.i18n.localize("TKNHAB.TileImg")
		};
	}

	/** Handle HUD button click */
	static buttonEventHandler(event, image, title) {
		const pop = this.createImagePopup(image, title);
		if (event.shiftKey && game.user.isGM) pop.shareImage();
	}

	/** Create image/video popout */
	static createImagePopup(image, title) {
		return new MultiMediaPopout(image, {
			title,
			shareable: true,
		}).render(true);
	}

	/** Get actor from token */
	static getTokenActor(tokenDoc) {
		return tokenDoc.actor ?? game.actors.get(tokenDoc.actorId);
	}

	/** Get token/actor names depending on visibility */
	static getTokenTitles(token, actor) {
		const M = CONST.TOKEN_DISPLAY_MODES;
		const dn = token.displayName;

		if (dn === M.ALWAYS || dn === M.HOVER) {
			return {
				actor: actor?.name ?? game.i18n.localize("TKNHAB.ActorImg"),
				token: token.name
			};
		}

		return {
			actor: game.i18n.localize("TKNHAB.ActorImg"),
			token: game.i18n.localize("TKNHAB.TokenImg")
		};
	}

	/** Get token/actor images */
	static getTokenImages(token, actor) {
		const mystery = "icons/svg/mystery-man.svg";

		let actorImg = actor?.img || actor?.prototypeToken?.texture?.src || mystery;
		let tokenImg = token.texture?.src || mystery;

		if (actorImg === mystery && tokenImg !== mystery) actorImg = tokenImg;
		if (tokenImg === mystery && actorImg !== mystery) tokenImg = actorImg;

		return { actor: actorImg, token: tokenImg };
	}

	/** Create HUD button */
	static createButton() {
		let button = document.createElement("div");
		button.classList.add("control-icon", "artwork-open");
		button.innerHTML = `<i class="fas fa-image fa-fw"></i>`;
		button.title = game.i18n.localize("TKNHAB.TooltipText");
		return button;
	}

	/** Add button to Token HUD */
	static prepTokenHUD(hud, html, token) {
		if (!(html instanceof jQuery)) html = $(html);

		const actor = token.actor ?? this.getTokenActor(token);
		const images = this.getTokenImages(token, actor);
		const titles = this.getTokenTitles(token, actor);
		const artButton = this.createButton();

		$(artButton)
			.click(ev => this.buttonEventHandler(ev, images.actor, titles.actor))
			.contextmenu(ev => this.buttonEventHandler(ev, images.token, titles.token));

		html.find("div.left").append(artButton);
	}

	/** Add button to Tile HUD */
	static prepTileHUD(hud, html, tile) {
		if (!(html instanceof jQuery)) html = $(html);

		const artButton = this.createButton();
		$(artButton).click(ev =>
			this.buttonEventHandler(ev, tile.document.texture?.src, game.i18n.localize("TKNHAB.TileImg"))
		);

		html.find("div.left").append(artButton);
	}
}

/** Extended popout supporting videos */
class MultiMediaPopout extends ImagePopout {
	constructor(src, options = {}) {
		super(src, options);
		this.video = [".mp4", ".webm"].some(ext => src.toLowerCase().endsWith(ext));
		this.options.template = "modules/show-art-button/media-popout.html";
	}

	async getData(options) {
		let data = await super.getData();
		data.isVideo = this.video;
		return data;
	}

	shareImage() {
		game.socket.emit("module.show-art-button", {
			image: this.object,
			title: this.options.title,
			uuid: this.options.uuid
		});
	}

	static _handleShareMedia({ image, title, uuid } = {}) {
		return new MultiMediaPopout(image, {
			title, uuid,
			shareable: false,
			editable: false
		}).render(true);
	}
}

/* Hooks */
Hooks.once("init", ShowArt.registerBindings.bind(ShowArt));

Hooks.once("ready", () => {
	game.socket.on("module.show-art-button", MultiMediaPopout._handleShareMedia);
});

Hooks.on("renderTileHUD", (app, html, data) => ShowArt.prepTileHUD(app, html, app.object));
Hooks.on("renderTokenHUD", (app, html, data) => ShowArt.prepTokenHUD(app, html, app.object));
