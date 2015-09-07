/**
 * change the current emitter type using the combobox value in the HTML file
 */
game.changeEmitter = function() {
    // get the html combobox value
    var type = document.getElementById("emitter_type").value;

    // remove all emitters
    game.EmitterList.clear();

    // create a new emitter
    var emitter = game.EmitterList.createEmitter();
    emitter.pos.z = 11;

    // check the emitter type
    switch (type) {
    case "fire":
        // set emitter params directly or create object with params and reset the same
        // see the next emitter type - smoke
        emitter.name = "fire";
        emitter.image = me.loader.getImage("explosion");
        emitter.resize(200, 0);
        emitter.totalParticles = 300;
        emitter.frequency = 50;
        emitter.angle = Number.prototype.degToRad(90);
        emitter.angleVariation = Number.prototype.degToRad(20);

        // move the emitter
        emitter.translate(-100, 200);
        break;
    case "smoke":
        // create an object with emitter params (optional)
        var params = {
            image : me.loader.getImage("smoke"),
            totalParticles : 200,
            frequency : 50,
            speed : 3,
            speedVariation : 2,
            angle : Number.prototype.degToRad(90),
            angleVariation : Number.prototype.degToRad(20),
            wind : 0.05
        };

        // create a new emitter with defaults defined in params
        emitter.reset(params);
        emitter.name = "smoke";

        // move the emitter
        emitter.translate(0, 200);
        break;
    case "fountain":
        // set emitter params
        emitter.name = "fountain";
        emitter.image = me.loader.getImage("blue");
        emitter.totalParticles = 300;
        emitter.maxParticles = 80;
        emitter.minLife = 500;
        emitter.maxLife = 2000;
        emitter.speed = 12;
        emitter.speedVariation = 4;
        emitter.angle = Number.prototype.degToRad(90);
        emitter.angleVariation = Number.prototype.degToRad(10);
        emitter.minStartScale = 0.6;
        emitter.maxStartScale = 1.0;
        emitter.gravity = 0.3;

        // move the emitter
        emitter.translate(0, 200);
        break;
    case "fireball":
        // set emitter params
        emitter.name = "fireball";
        emitter.image = me.loader.getImage("fireball");
        emitter.totalParticles = 200;
        emitter.maxParticles = 50;
        emitter.frequency = 200;
        emitter.angle = 0;
        emitter.angleVariation = Number.prototype.degToRad(30);
        emitter.minLife = 1000;
        emitter.maxLife = 5000;
        emitter.speed = 3;
        emitter.speedVariation = 2;

        // move the emitter
        emitter.pos.set(100, 300);
        break;
    case "rain":
        // set emitter params
        emitter.name = "rain";
        emitter.image = me.loader.getImage("rain");
        emitter.resize(600, 40);
        emitter.totalParticles = 400;
        emitter.frequency = 10;
        emitter.minLife = 1000;
        emitter.maxLife = 8000;
        emitter.speed = 0;
        emitter.speedVariation = 0;
        emitter.angle = Number.prototype.degToRad(270);
        emitter.angleVariation = 0;
        emitter.minStartScale = 0.3;
        emitter.maxStartScale = 0.6;
        emitter.gravity = 0.6;

        // move the emitter
        emitter.pos.set(100, 20);
        break;
    case "cannon":
        // set emitter params
        emitter.name = "cannon";
        emitter.image = me.loader.getImage("fireball");
        emitter.totalParticles = 25;
        emitter.maxParticles = 1;
        emitter.frequency = 200;
        emitter.angle = Number.prototype.degToRad(70);
        emitter.angleVariation = 0;
        emitter.minLife = 1000;
        emitter.maxLife = 5000;
        emitter.speed = 6.5;
        emitter.speedVariation = 1.5;
        emitter.gravity = 0.1;

        // particle update the rotation in accordance the trajectory
        emitter.followTrajectory = true;

        // move the emitter
        emitter.pos.x = 100;
        break;
    case "radial":
        // simulate a explosion in all directions - Single Shoot
        // set emitter params
        emitter.name = "radial explosion";
        emitter.image = me.loader.getImage("explosion");
        emitter.totalParticles = 500;
        emitter.resize(10, 0);
        emitter.angle = 0;
        emitter.angleVariation = Number.prototype.degToRad(360);
        emitter.minLife = 1000;
        emitter.maxLife = 5000;

        // start the emitter, output all particles and stop
        // optional - inform the quantity of particles to emit
        emitter.stopStream();
        emitter.burstParticles(500);
        break;
    case "directed":
        // simulate a explosion directed - Single Shoot
        // set emitter params
        emitter.name = "directed explosion";
        emitter.image = me.loader.getImage("explosion");
        emitter.angle = 0;
        emitter.angleVariation = Number.prototype.degToRad(30);
        emitter.minLife = 1000;
        emitter.maxLife = 2000;

        // move the emitter
        emitter.pos.set(100, 300);

        // start the emitter, output all particles and stop
        // optional - inform the quantity of particles to emit
        emitter.stopStream();
        emitter.burstParticles(100);
        break;
    case "waterfall":
        // set emitter params
        emitter.name = "waterfall";
        emitter.image = me.loader.getImage("blue");
        emitter.resize(100, 0);
        emitter.totalParticles = 500;
        emitter.maxParticles = 20;
        emitter.frequency = 30;
        emitter.minLife = 2000;
        emitter.maxLife = 5000;
        emitter.speed = 2;
        emitter.speedVariation = 2;
        emitter.gravity = 0.3;

        // move the emitter
        emitter.pos.set(350, 20);

        // start the emitter with continuous particle output
        // optional - inform the emitter time to launch particles
        emitter.stopStream();
        emitter.streamParticles(10000);
        break;
    case "multiples":
        // simulate a fireworks with smoke - Two Emitters
        // set emitter params
        emitter.name = "fire";
        emitter.image = me.loader.getImage("explosion");
        emitter.totalParticles = 300;
        emitter.frequency = 10;
        emitter.minLife = 500;
        emitter.maxLife = 3000;
        emitter.speed = 12;
        emitter.speedVariation = 4;
        emitter.angle = Number.prototype.degToRad(90);
        emitter.angleVariation = Number.prototype.degToRad(10);
        emitter.minStartScale = 0.2;
        emitter.maxStartScale = 0.4;
        emitter.minEndScale = 1.0;
        emitter.maxEndScale = 1.5;
        emitter.gravity = 0.3;

        // move the emitter
        emitter.translate(0, 200);

        // create a new emitter
        emitter = game.EmitterList.createEmitter();

        // set emitter params
        emitter.name = "smoke";
        emitter.pos.z = 10;
        emitter.image = me.loader.getImage("smoke");
        emitter.resize(20, 0);
        emitter.totalParticles = 250;
        emitter.frequency = 30;
        emitter.minLife = 2000;
        emitter.maxLife = 5000;
        emitter.angle = Number.prototype.degToRad(90);
        emitter.angleVariation = Number.prototype.degToRad(20);
        emitter.minStartScale = 0.2;
        emitter.maxStartScale = 0.4;

        // move the emitter
        emitter.translate(0, 200);
        break;
    default:
        emitter.stopStream();
    }
    me.event.publish("propertyChanged", [ game.EmitterController.emitter ]);
};

game.togglePanel = function(element) {
    var classList = element.parentNode.classList;
    if (classList.contains("hidden")) {
        classList.remove("hidden");
        classList.add("slidein");
    } else {
        classList.add("hidden");
        classList.add("slideout");
    }
};

game.clearPanelAnimation = function(event) {
    var classList = event.target.classList;
    classList.remove("slidein");
    classList.remove("slideout");
};
