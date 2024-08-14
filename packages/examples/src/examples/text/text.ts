import {
	BitmapText,
	type Color,
	Renderable,
	Text,
	Tween,
	getPool,
	video,
} from "melonjs";

export class TextTest extends Renderable {
	color: Color;

	constructor() {
		super(0, 0, 640, 480);

		this.anchorPoint.set(0, 0);

		// a default white color object
		this.color = getPool("color").get(255, 255, 255);

		// define a tween to cycle the font color
		this.tween = new Tween(this.color)
			.to(
				{
					g: 0,
					b: 0,
				},
				2000,
			)
			.repeat(Number.POSITIVE_INFINITY)
			.yoyo(true)
			.start();

		// text font
		this.font = new Text(0, 0, {
			font: "Arial",
			size: 8,
			fillStyle: "white",
		});

		// bitmap font
		this.bFont = new BitmapText(0, 0, { font: "xolo12", size: 4.0 });
		this.fancyBFont = new BitmapText(0, 0, { font: "arialfancy" });
	}

	// draw function
	draw(renderer) {
		let text = "";
		let xPos = 0;
		let yPos = 0;

		// black background
		renderer.clearColor("#202020");

		// font size test
		this.font.textAlign = "left";
		this.font.strokeStyle.parseCSS("red");
		this.font.lineWidth = 1;
		this.font.setOpacity(0.5);
		for (let i = 8; i < 56; i += 8) {
			this.font.setFont("Arial", i);
			renderer.setTint(this.color);
			this.font.draw(renderer, `Arial Text ${i}px !`, 5, yPos);
			yPos += this.font.getBounds().height;
		}
		this.font.lineWidth = 0;

		// bFont size test
		yPos = 0;
		this.bFont.textAlign = "right";
		this.bFont.fillStyle.parseCSS("indigo");
		for (let i = 1; i < 5; i++) {
			//this.bFont.setOpacity (0.1 * i);
			this.bFont.resize(i * 0.75);
			this.bFont.fillStyle.lighten(0.25);
			// call preDraw and postDraw for the tint to work
			// as the font is not added to the game world
			this.bFont.preDraw(renderer);
			this.bFont.draw(renderer, "BITMAP TEST", video.renderer.width, yPos);
			this.bFont.postDraw(renderer);
			yPos += this.bFont.getBounds().height * 1.5;
		}

		this.font.setOpacity(1);
		this.bFont.setOpacity(1);

		// font baseline test
		this.font.setFont("Arial", 16);
		let baseline = 200;

		// Draw the baseline
		video.renderer.setColor("red");
		video.renderer.lineWidth = 3;
		video.renderer.strokeLine(
			0,
			baseline + 0.5,
			video.renderer.width,
			baseline + 0.5,
		);

		const baselines = [
			"bottom",
			"ideographic",
			"alphabetic",
			"middle",
			"hanging",
			"top",
		];

		// font baseline test
		video.renderer.setColor("white");
		for (let i = 0; i < baselines.length; i++) {
			text = baselines[i];
			this.font.textBaseline = baselines[i];
			this.font.lineWidth = 0;
			this.font.draw(renderer, text, xPos, baseline);
			xPos += this.font.measureText(renderer, `${text}@@@`).width;
		}

		// restore default baseline
		this.font.textBaseline = "top";

		// ---- multiline testing -----

		// font text
		text =
			"this is a multiline font\n test with melonjs and it\nworks even with a\n specific lineHeight value!";
		this.font.textAlign = "center";
		this.font.lineHeight = 1.1;
		this.font.lineWidth = 0;
		this.font.draw(renderer, text, 90, 210);

		text =
			"this is another web font \nwith right alignment\nand it still works!";
		this.font.textAlign = "right";
		this.font.lineHeight = 1.1;
		this.font.draw(renderer, text, 200, 300);

		// bitmapfonts
		// bFont  test
		this.fancyBFont.textAlign = "right";
		this.fancyBFont.wordWrapWidth = 430;
		text =
			"ANOTHER FANCY MULTILINE BITMAP TEXT USING WORD WRAP AND IT STILL WORKS";
		this.fancyBFont.lineHeight = 1.2;
		this.fancyBFont.resize(1.5);
		this.fancyBFont.draw(renderer, text, 620, 230);
		this.fancyBFont.lineHeight = 1.0;
		this.fancyBFont.wordWrapWidth = -1;

		this.bFont.textAlign = "center";
		text = "THIS IS A MULTILINE\n BITMAP TEXT WITH MELONJS\nAND IT WORKS";
		this.bFont.resize(2.5);
		this.bFont.draw(renderer, text, video.renderer.width / 2, 400);

		// baseline test with bitmap font
		xPos = 0;
		this.fancyBFont.textAlign = "left";
		baseline = 375;

		// Draw the baseline
		video.renderer.setColor("red");
		video.renderer.strokeLine(
			0,
			baseline + 0.5,
			video.renderer.width,
			baseline + 0.5,
		);

		// font baseline test
		video.renderer.setColor("white");
		this.fancyBFont.resize(1.275);
		for (let i = 0; i < baselines.length; i++) {
			text = baselines[i];
			this.fancyBFont.textBaseline = baselines[i];
			this.fancyBFont.draw(renderer, text, xPos, baseline);
			xPos += this.fancyBFont.measureText(`${text}@`).width;
		}

		// restore default alignement/baseline
		this.font.textAlign = "left";
		this.font.textBaseline = "top";
		this.bFont.textAlign = "left";
		this.bFont.textBaseline = "top";
		this.fancyBFont.textAlign = "left";
		this.fancyBFont.textBaseline = "top";
	}

	destroy() {
		getPool("color").release(this.color);
	}
}
