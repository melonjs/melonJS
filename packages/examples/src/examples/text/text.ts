import {
	type Application,
	BitmapText,
	ColorLayer,
	Renderable,
	Stage,
	Text,
} from "melonjs";

/**
 * Overlay that draws the two red baseline reference lines.
 */
class BaselineOverlay extends Renderable {
	constructor(w: number, h: number) {
		super(0, 0, w, h);
		this.anchorPoint.set(0, 0);
		this.alwaysUpdate = true;
	}

	override update() {
		return true;
	}

	override draw(renderer) {
		renderer.setColor("red");
		renderer.lineWidth = 3;
		renderer.strokeLine(0, 200.5, this.width, 200.5);
		renderer.strokeLine(0, 375.5, this.width, 375.5);
		renderer.lineWidth = 1;
	}
}

/**
 * Text example Stage.
 */
export class TextScreen extends Stage {
	onResetEvent(app: Application) {
		const w = app.viewport.width;

		app.world.addChild(new ColorLayer("background", "#202020"), 0);
		app.world.addChild(new BaselineOverlay(w, app.viewport.height), 2);

		// ---- Font size test (left side) ----
		let yPos = 0;
		for (let i = 8; i < 56; i += 8) {
			const t = new Text(5, yPos, {
				font: "Arial",
				size: i,
				fillStyle: "white",
				strokeStyle: "red",
				lineWidth: 1,
				textBaseline: "top",
				textAlign: "left",
				text: `Arial Text ${i}px !`,
			});
			t.setOpacity(0.5);
			app.world.addChild(t, 1);
			yPos += t.getBounds().height;
		}

		// ---- BitmapText size test (right side) ----
		yPos = 0;
		for (let i = 1; i < 5; i++) {
			const b = new BitmapText(w, yPos, {
				font: "xolo12",
				size: i * 0.75,
				textAlign: "right",
				textBaseline: "top",
				text: "BITMAP TEST",
			});
			b.fillStyle.parseCSS("indigo");
			for (let j = 0; j < i; j++) {
				b.fillStyle.lighten(0.25);
			}
			app.world.addChild(b, 1);
			yPos += b.getBounds().height * 1.5;
		}

		// ---- Font baseline test (y=200) ----
		const baselines = [
			"bottom",
			"ideographic",
			"alphabetic",
			"middle",
			"hanging",
			"top",
		];
		let xPos = 0;

		// we need a temp Text to measure widths for spacing
		const tmpFont = new Text(0, 0, {
			font: "Arial",
			size: 16,
			fillStyle: "white",
		});
		for (const bl of baselines) {
			const t = new Text(xPos, 200, {
				font: "Arial",
				size: 16,
				fillStyle: "white",
				textBaseline: bl,
				textAlign: "left",
				text: bl,
			});
			app.world.addChild(t, 3);
			// measure with extra chars for spacing (matching original)
			tmpFont.textBaseline = bl;
			tmpFont.setText(`${bl}@@@`);
			xPos += tmpFont.measureText().width;
		}

		// ---- Multiline text (center aligned) ----
		app.world.addChild(
			new Text(90, 210, {
				font: "Arial",
				size: 14,
				fillStyle: "white",
				textAlign: "center",
				textBaseline: "top",
				lineHeight: 1.1,
				text: "this is a multiline font\n test with melonjs and it\nworks even with a\n specific lineHeight value!",
			}),
			1,
		);

		// ---- Multiline text (right aligned) ----
		app.world.addChild(
			new Text(165, 290, {
				font: "Arial",
				size: 14,
				fillStyle: "white",
				textAlign: "right",
				textBaseline: "top",
				lineHeight: 1.1,
				text: "this is another web font \nwith right alignment\nand it still works!",
			}),
			1,
		);

		// ---- Fancy BitmapText multiline with word wrap ----
		const fancy = new BitmapText(620, 230, {
			font: "arialfancy",
			textAlign: "right",
			textBaseline: "top",
			size: 1.5,
		});
		fancy.lineHeight = 1.2;
		fancy.wordWrapWidth = 430;
		fancy.setText(
			"ANOTHER FANCY MULTILINE BITMAP TEXT USING WORD WRAP AND IT STILL WORKS",
		);
		app.world.addChild(fancy, 1);

		// ---- BitmapText multiline centered ----
		const bMulti = new BitmapText(w / 2, 400, {
			font: "xolo12",
			size: 2.5,
			textAlign: "center",
			textBaseline: "top",
			text: "THIS IS A MULTILINE\n BITMAP TEXT WITH MELONJS\nAND IT WORKS",
		});
		app.world.addChild(bMulti, 1);

		// ---- BitmapText baseline test (y=375) ----
		xPos = 0;
		const tmpBFont = new BitmapText(0, 0, { font: "arialfancy", size: 1.275 });
		for (const bl of baselines) {
			const b = new BitmapText(xPos, 375, {
				font: "arialfancy",
				size: 1.275,
				textBaseline: bl,
				textAlign: "left",
				text: bl,
			});
			app.world.addChild(b, 3);
			tmpBFont.textBaseline = bl;
			tmpBFont.setText(`${bl}@`);
			xPos += tmpBFont.measureText().width;
		}
	}
}
