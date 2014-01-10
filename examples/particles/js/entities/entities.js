/**
 *  change the current emitter type
 *  using the combobox value in the HTML file
 */
game.changeEmitter = function() {
	// get the html combobox value
	var type = document.getElementById("emitter_type").value;

	// get the html checkbox value
	var additive = document.getElementById("emitter_additive");

	// check if the emitter is running and stop the same
	if (game.Emitter.isRunning)
		game.Emitter.stopStream();

	// check if the emitter auxiliary is running and stop the same
	if (game.EmitterAux.isRunning)
		game.EmitterAux.stopStream();

	// check the emitter type
	switch (type) {
		case "fire":
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params directly or create object with params and reset the same
			// see the next emitter type - smoke
			game.Emitter.image = me.loader.getImage("explosion");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.varPos.x = 100;
			game.Emitter.totalParticles = 300;
			game.Emitter.frequency = 50;
			game.Emitter.minAngle = Number.prototype.degToRad(70);
			game.Emitter.maxAngle = Number.prototype.degToRad(110);

			// start the emitter with continuous particle output
			game.Emitter.streamParticles();
		break;
		case "smoke":
			// create a object with emitter params (opcional)
			var params = {
				image: me.loader.getImage("smoke"),
				textureAdditive: additive.checked,
				totalParticles: 200,
				frequency: 50,
				minSpeed: 1,
				maxSpeed: 5,
				minAngle: Number.prototype.degToRad(70),
				maxAngle: Number.prototype.degToRad(110),
				wind: 0.05
			};

			// reset the emitter to defaults defined in params
			game.Emitter.reset(params);

			// start the emitter with continuous particle output
			game.Emitter.streamParticles();
		break;
		case "fountain":
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("blue");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.totalParticles = 300;
			game.Emitter.maxParticles = 80;
			game.Emitter.minLife = 500;
			game.Emitter.maxLife = 2000;
			game.Emitter.minSpeed = 8;
			game.Emitter.maxSpeed = 16;
			game.Emitter.minAngle = Number.prototype.degToRad(80);
			game.Emitter.maxAngle = Number.prototype.degToRad(100);
			game.Emitter.minStartScale = 0.6;
			game.Emitter.maxStartScale = 1.0;
			game.Emitter.gravity = 0.3;

			// start the emitter with continuous particle output
			game.Emitter.streamParticles();
		break;
		case "fireball":
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("fireball");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.pos.x = 10;
			game.Emitter.pos.y = 200;
			game.Emitter.totalParticles = 200;
			game.Emitter.maxParticles = 50;
			game.Emitter.frequency = 200;
			game.Emitter.minAngle = Number.prototype.degToRad(-30);
			game.Emitter.maxAngle = Number.prototype.degToRad(30);
			game.Emitter.minLife = 1000;
			game.Emitter.maxLife = 5000;
			game.Emitter.minSpeed = 1;
			game.Emitter.maxSpeed = 5;

			// start the emitter with continuous particle output
			game.Emitter.streamParticles();
		break;
		case "rain":
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("rain");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.pos.y = 0;
			game.Emitter.varPos.y = 20;
			game.Emitter.varPos.x = 300;
			game.Emitter.totalParticles = 400;
			game.Emitter.frequency = 10;
			game.Emitter.minLife = 1000;
			game.Emitter.maxLife = 8000;
			game.Emitter.minSpeed = 0;
			game.Emitter.maxSpeed = 0;
			game.Emitter.minAngle = Number.prototype.degToRad(270);
			game.Emitter.maxAngle = game.Emitter.minAngle;
			game.Emitter.minStartScale = 0.3;
			game.Emitter.maxStartScale = 0.6;
			game.Emitter.gravity = 0.6;

			// start the emitter with continuous particle output
			game.Emitter.streamParticles();
		break;
		case "cannon":
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("fireball");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.pos.x = 100;
			game.Emitter.totalParticles = 25;
			game.Emitter.maxParticles = 1;
			game.Emitter.frequency = 200;
			game.Emitter.minAngle = Number.prototype.degToRad(70);
			game.Emitter.maxAngle = game.Emitter.minAngle;
			game.Emitter.minLife = 1000;
			game.Emitter.maxLife = 5000;
			game.Emitter.minSpeed = 5;
			game.Emitter.maxSpeed = 8;
			game.Emitter.gravity = 0.1;

			// particle update the rotation in accordance the trajectory
			game.Emitter.followTrajectory = true;

			// start the emitter with continuous particle output
			game.Emitter.streamParticles();
		break;
		case "radial":
			// simulate a explosion in all directions - Single Shoot
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("explosion");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.pos.y = 200;
			game.Emitter.varPos.x = 5;
			game.Emitter.minAngle = Number.prototype.degToRad(0);
			game.Emitter.maxAngle = Number.prototype.degToRad(360);
			game.Emitter.minLife = 1000;
			game.Emitter.maxLife = 5000;

			// start the emitter, output all particles and stop
			// optional - inform the quantity of particles to emit
			game.Emitter.burstParticles(500);
		break;
		case "directed":
			// simulate a explosion directed - Single Shoot
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("explosion");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.pos.x = 100;
			game.Emitter.pos.y = 200;
			game.Emitter.minAngle = Number.prototype.degToRad(30);
			game.Emitter.maxAngle = Number.prototype.degToRad(-30);
			game.Emitter.minLife = 1000;
			game.Emitter.maxLife = 2000;

			// start the emitter, output all particles and stop
			// optional - inform the quantity of particles to emit
			game.Emitter.burstParticles(100);
		break;
		case "waterfall":
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("blue");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.pos.y = 10;
			game.Emitter.varPos.x = 50;
			game.Emitter.totalParticles = 500;
			game.Emitter.maxParticles = 20;
			game.Emitter.frequency = 30;
			game.Emitter.minLife = 2000;
			game.Emitter.maxLife = 5000;
			game.Emitter.minSpeed = 0;
			game.Emitter.gravity = 0.3;

			// start the emitter with continuous particle output
			// optional - inform the emitter time to launch particles
			game.Emitter.streamParticles(10000);
		break;
		case "multiples":
			// simulate a fireworks with smoke - Two Emitters
			// reset the emitter to defaults
			game.Emitter.reset();

			// set emitter params
			game.Emitter.image = me.loader.getImage("explosion");
			game.Emitter.textureAdditive = additive.checked;
			game.Emitter.totalParticles = 300;
			game.Emitter.frequency = 10;
			game.Emitter.minLife = 500;
			game.Emitter.maxLife = 3000;
			game.Emitter.minSpeed = 8;
			game.Emitter.maxSpeed = 16;
			game.Emitter.minAngle = Number.prototype.degToRad(80);
			game.Emitter.maxAngle = Number.prototype.degToRad(100);
			game.Emitter.minStartScale = 0.2;
			game.Emitter.maxStartScale = 0.4;
			game.Emitter.minEndScale = 1.0;
			game.Emitter.maxEndScale = 1.5;
			game.Emitter.gravity = 0.3;

			// start the emitter with continuous particle output - fireworks
			game.Emitter.streamParticles();

			// reset the emitter aux to defaults
			game.EmitterAux.reset();

			// set emitter aux params
			game.EmitterAux.image = me.loader.getImage("smoke");
			game.EmitterAux.varPos.x = 10;
			game.EmitterAux.totalParticles = 250;
			game.EmitterAux.frequency = 30;
			game.EmitterAux.minLife = 2000;
			game.EmitterAux.maxLife = 5000;
			game.EmitterAux.minAngle = Number.prototype.degToRad(70);
			game.EmitterAux.maxAngle = Number.prototype.degToRad(110);
			game.Emitter.minStartScale = 0.2;
			game.Emitter.maxStartScale = 0.4;

			// start the emitter aux with continuous particle output - smoke
			game.EmitterAux.streamParticles();
		break;
	}
};

/**
 *  change the emitter draw - texture additive
 *  using the combobox value in the HTML file
 */
game.changeAdditive = function() {
	// get the html checkbox value
	var additive = document.getElementById("emitter_additive");

	// enable texture additive in the emitter and change background color
	game.Emitter.textureAdditive = additive.checked;
};
