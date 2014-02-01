game.ParticleEditor = game.ParticleEditor || {};

game.ParticleEditor.EmitterList = Object.extend({
    init : function(emitterController, containerId) {
        this.emitterController = emitterController;
        this.emitters = [];
        this.rootNode = document.getElementById(containerId);

        var select = this.emitterList = document.createElement("select");
        select.setAttribute("size", 35);
        select.addEventListener("change", this.onChange.bind(this));
        this.rootNode.appendChild(select);

        var createButton = document.createElement("input");
        createButton.value = "create";
        createButton.setAttribute("type", "button");
        createButton.addEventListener("click", this.createEmitter.bind(this));
        this.rootNode.appendChild(createButton);

        var destroyButton = document.createElement("input");
        destroyButton.value = "destroy";
        destroyButton.setAttribute("type", "button");
        destroyButton.addEventListener("click", this.destroyEmitter.bind(this));
        this.rootNode.appendChild(destroyButton);

        me.event.subscribe("emitterChanged", this.updateList.bind(this));
    },

    createEmitter : function() {
        var emitter = new me.ParticleEmitter(me.game.viewport.getWidth() / 2, me.game.viewport.getHeight() / 2, me.loader.getImage(game.resources[0].name));
        emitter.name = "emitter" + me.utils.createGUID();
        emitter.z = 10;
        me.game.world.addChild(emitter);
        me.game.world.addChild(emitter.container);
        emitter.streamParticles();
        this.addEmitter(emitter);
        this.updateList();
        this.selectEmitter(emitter);
        this.onChange();
    },

    destroyEmitter : function() {
        var emitter = this.emitters[this.emitterList.selectedIndex];
        this.removeEmitter(emitter);
        me.game.world.removeChild(emitter.container);
        me.game.world.removeChild(emitter);
        this.updateList();
        if (this.emitterList.selectedIndex === -1) {
            this.selectEmitter(this.emitters[this.emitters.length - 1]);
        }
        this.onChange();
    },

    addEmitter : function(emitter) {
        this.emitters.push(emitter);
    },

    removeEmitter : function(emitter) {
        for ( var emitters = this.emitters, i = emitters.length, obj; i--, obj = emitters[i];) {
            if (obj === emitter) {
                emitters.splice(i, 1);
                break;
            }
        }
    },

    selectEmitter : function(emitter) {
        for ( var emitters = this.emitters, i = emitters.length, obj; i--, obj = emitters[i];) {
            if (obj === emitter) {
                this.emitterList.selectedIndex = i;
                break;
            }
        }
    },

    updateList : function() {
        var select = this.emitterList;
        var options = [];

        var option = select.firstChild;
        while (option) {
            options[option.value] = option;
            option = option.nextSibling;
        }

        for ( var i = 0, emitters = this.emitters, length = emitters.length, emitter; i < length; ++i) {
            emitter = emitters[i];
            if (options[i]) {
                option = options[i];
                option.firstChild.textContent = emitter.name;
                options[i] = null;
            } else {
                option = document.createElement("option");
                option.appendChild(document.createTextNode(emitter.name));
            }
            option.setAttribute("value", i);
            select.appendChild(option);
        }

        for ( var i = options.length, obj; i--, obj = options[i];) {
            if (!!obj) {
                obj.remove();
            }
        }
    },

    onChange : function() {
        var emitter = this.emitters[this.emitterList.selectedIndex];
        if (!!emitter) {
            this.emitterController.setEmitter(emitter);
        }
    }
});

game.ParticleEditor.EmitterController = Object.extend({
    init : function(emitter, containerId) {
        this.widgets = [];
        this.rootNode = document.getElementById(containerId);
        this.rootNode.classList.add("controls");

        this.addWidget(new game.ParticleEditor.TextInputWidget(emitter, "name"));
        var widget = new game.ParticleEditor.IntegerInputWidget(emitter, "width");
        widget.setPropertyValue = function(value) {
            var object = this.object;
            if (object.width !== value) {
                object.resize(value, object.height);
                me.event.publish("emitterChanged", [ object ]);
            }
        };
        this.addWidget(widget);
        widget = new game.ParticleEditor.IntegerInputWidget(emitter, "height");
        widget.setPropertyValue = function(value) {
            var object = this.object;
            if (object.height !== value) {
                object.resize(object.width, value);
                me.event.publish("emitterChanged", [ object ]);
            }
        };
        this.addWidget(widget);
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "z"));
        this.addWidget(new game.ParticleEditor.ImageSelectionWidget(emitter, "image"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "totalParticles"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "minAngle"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "maxAngle"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "minLife"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "maxLife"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "minSpeed"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "maxSpeed"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "minRotation"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "maxRotation"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "minStartScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "maxStartScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "minEndScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "maxEndScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "gravity"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget(emitter, "wind"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget(emitter, "followTrajectory"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget(emitter, "textureAdditive"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget(emitter, "onlyInViewport"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget(emitter, "floating"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "maxParticles"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "frequency"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "duration"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget(emitter, "framesToSkip"));

        this.setEmitter(emitter);
        me.event.subscribe("emitterChanged", this.onChange.bind(this));
    },

    setEmitter : function(emitter) {
        this.emitter = emitter;
        this.widgets.forEach(this.sync, this);
    },

    onChange : function(emitter) {
        if (this.emitter === emitter) {
            this.widgets.forEach(this.sync, this);
        }
    },

    sync : function(widget) {
        widget.object = this.emitter;
        widget.sync();
    },

    addWidget : function(widget) {
        widget.appendTo(this.rootNode);
        this.widgets.push(widget);
    },
});