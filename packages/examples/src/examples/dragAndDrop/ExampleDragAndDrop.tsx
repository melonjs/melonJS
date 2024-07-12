import { ColorLayer, Draggable, DropTarget, Text, game, video } from "melonjs";
import { createExampleComponent } from "../utils";

class Square extends Draggable {
	constructor(x, y, settings) {
		// call the super constructor
		super(x, y, settings.width, settings.height);
		// set the color to white
		this.color = "white";
		// set the font we want to use
		this.font = new Text(0, 0, {
			font: "Verdana",
			size: 15,
			fillStyle: "black",
		});
		this.font.bold();
		// set the text
		this.text = "Drag me";
	}
	/**
	 * update function
	 */
	update(dt) {
		super.update(dt);
		return true;
	}
	/**
	 * draw the square
	 */
	draw(renderer) {
		renderer.setColor(this.color);
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
		this.font.draw(renderer, this.text, this.pos.x, this.pos.y);
	}
	/**
	 * dragStart overwrite function
	 */
	dragStart(e) {
		// call the super function
		super.dragStart(e);
		// set the color to blue
		this.color = "blue";
	}
	dragEnd(e) {
		// call the super function
		super.dragEnd(e);
		// set the color to white
		this.color = "white";
	}
}

class DropTarget1 extends DropTarget {
	/**
	 * constructor
	 */
	constructor(x, y, settings) {
		// call the parent constructor
		super(x, y, settings.width, settings.height);
		// set the color to white
		this.color = "red";
		// set the font we want to use
		this.font = new Text(0, 0, {
			font: "Verdana",
			size: 15,
			fillStyle: "black",
		});

		this.font.bold();
		// set the text
		this.text = 'Drop on me\n\nAnd I"ll turn green\n\ncheckmethod: overlap';
	}
	/**
	 * update function
	 */
	update(dt) {
		super.update(dt);
		return true;
	}
	/**
	 * draw the square
	 */
	draw(renderer) {
		renderer.setColor(this.color);
		renderer.fillRect(this.pos.x, this.pos.y, this.width, this.height);
		this.font.draw(renderer, this.text, this.pos.x, this.pos.y);
	}
	/**
	 * drop overwrite function
	 */
	drop(e) {
		// call the super function
		super.drop(e);

		// indicate a succesful drop
		this.color = "green";
		// set the color back to red after a second
		window.setTimeout(() => {
			this.color = "red";
		}, 1000);
	}
}

class DropTarget2 extends DropTarget1 {
	/**
	 * constructor
	 */
	constructor(x, y, settings) {
		// call the super constructor
		super(x, y, settings);
		// set the color to white
		this.color = "red";
		// set the font we want to use
		this.font = new Text(0, 0, {
			font: "Verdana",
			size: 15,
			fillStyle: "black",
		});
		this.font.bold();
		// set the text
		this.text = 'Drop on me\n\nAnd I"ll turn green\n\ncheckmethod: contains';
		// set the check method to "contains" (default is "overlap")
		this.setCheckMethod(this.CHECKMETHOD_CONTAINS);
	}
}

const createGame = () => {
	// Initialize the video.
	if (!video.init(1024, 768, { scale: "auto", renderer: video.CANVAS })) {
		alert("Your browser does not support HTML5 canvas.");
		return;
	}

	// clear the background
	game.world.addChild(new ColorLayer("background", "#000000", 0), 0);

	// add a few squares
	game.world.addChild(new Square(200, 230, { width: 100, height: 100 }), 1);

	// add a droptarget entity
	game.world.addChild(
		new DropTarget1(400, 200, { width: 200, height: 150 }),
		1,
	);

	// add another droptarget entity
	game.world.addChild(
		new DropTarget2(400, 400, { width: 200, height: 150 }),
		1,
	);
};

export const ExampleDragAndDrop = createExampleComponent(createGame);
