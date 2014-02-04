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

        me.event.subscribe("propertyChanged", this.updateList.bind(this));
    },

    clear : function() {
        for ( var emitters = this.emitters, i = emitters.length, obj; i--, obj = emitters[i];) {
            me.game.world.removeChild(obj.container);
            me.game.world.removeChild(obj);
        }
        this.emitters.length = 0;
        this.updateList();
    },

    createEmitter : function(params) {
        var emitter = new me.ParticleEmitter(me.game.viewport.getWidth() / 2, me.game.viewport.getHeight() / 2, me.loader.getImage(game.resources[0].name));
        if (params) {
            emitter.reset(params);
        }
        emitter.name = "emitter" + me.utils.createGUID();
        emitter.z = 10;
        me.game.world.addChild(emitter);
        me.game.world.addChild(emitter.container);
        emitter.streamParticles();
        this.addEmitter(emitter);
        this.selectEmitter(emitter);
        return emitter;
    },

    destroyEmitter : function() {
        var emitter = this.emitters[this.emitterList.selectedIndex];
        if (emitter) {
            this.removeEmitter(emitter);
            me.game.world.removeChild(emitter.container);
            me.game.world.removeChild(emitter);
            return emitter;
        }
        return null;
    },

    addEmitter : function(emitter) {
        this.emitters.push(emitter);
        this.updateList();
    },

    removeEmitter : function(emitter) {
        for ( var emitters = this.emitters, i = emitters.length, obj; i--, obj = emitters[i];) {
            if (obj === emitter) {
                emitters.splice(i, 1);
                this.updateList();
                break;
            }
        }
    },

    selectEmitter : function(emitter) {
        this.emitterList.selectedIndex = -1;
        for ( var emitters = this.emitters, i = emitters.length, obj; i--, obj = emitters[i];) {
            if (obj === emitter) {
                this.emitterList.selectedIndex = i;
                break;
            }
        }
        this.onChange();
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

        if (select.selectedIndex === -1) {
            this.selectEmitter(this.emitters[this.emitters.length - 1]);
        }
    },

    onChange : function() {
        var emitter = this.emitters[this.emitterList.selectedIndex];
        this.emitterController.setEmitter(emitter || null);
    }
});

game.ParticleEditor.EmitterController = Object.extend({
    init : function(containerId) {
        this.widgets = [];
        this.rootNode = document.getElementById(containerId);
        this.rootNode.classList.add("controls");

        var buttonContainer = document.createElement("div");
        buttonContainer.classList.add("buttons");
        this.rootNode.appendChild(buttonContainer);

        var streamButton = this.streamButton = document.createElement("input");
        streamButton.value = "stream";
        streamButton.setAttribute("type", "button");
        streamButton.addEventListener("click", this.controlStream.bind(this));
        buttonContainer.appendChild(streamButton);

        var burstButton = document.createElement("input");
        burstButton.value = "burst";
        burstButton.setAttribute("type", "button");
        burstButton.addEventListener("click", this.controlBurst.bind(this));
        buttonContainer.appendChild(burstButton);

        this.addWidget(new game.ParticleEditor.ShapeWidget());
        this.addWidget(new game.ParticleEditor.TextInputWidget("name"));
        var widget = new game.ParticleEditor.IntegerInputWidget("width");
        widget.property.setValue = function(value) {
            var object = this.object;
            if (object.width !== value) {
                object.resize(value, object.height);
                me.event.publish("propertyChanged", [ object ]);
            }
        };
        this.addWidget(widget);
        widget = new game.ParticleEditor.IntegerInputWidget("height");
        widget.property.setValue = function(value) {
            var object = this.object;
            if (object.height !== value) {
                object.resize(object.width, value);
                me.event.publish("propertyChanged", [ object ]);
            }
        };
        this.addWidget(widget);
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("z"));
        this.addWidget(new game.ParticleEditor.ImageSelectionWidget("image"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("totalParticles"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("minAngle"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("maxAngle"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("minLife"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("maxLife"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("minSpeed"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("maxSpeed"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("minRotation"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("maxRotation"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("minStartScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("maxStartScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("minEndScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("maxEndScale"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("gravity"));
        this.addWidget(new game.ParticleEditor.FloatInputWidget("wind"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget("followTrajectory"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget("textureAdditive"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget("onlyInViewport"));
        this.addWidget(new game.ParticleEditor.BooleanInputWidget("floating"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("maxParticles"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("frequency"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("duration"));
        this.addWidget(new game.ParticleEditor.IntegerInputWidget("framesToSkip"));

        me.event.subscribe("propertyChanged", this.onChange.bind(this));
    },

    controlStream : function(event) {
        if (!this.emitter.isRunning()) {
            this.emitter.streamParticles();
        } else {
            this.emitter.stopStream();
        }
        this.updateStreamButton();
    },

    controlBurst : function(event) {
        this.emitter.burstParticles();
        this.updateStreamButton();
    },

    setEmitter : function(emitter) {
        this.emitter = emitter;
        this.widgets.forEach(this.sync, this);
        this.updateStreamButton();
    },

    updateStreamButton : function() {
        if (this.emitter && this.emitter.isRunning()) {
            this.streamButton.value = "stop stream";
        } else {
            this.streamButton.value = "start stream";
        }
    },

    onChange : function(emitter) {
        if (this.emitter === emitter) {
            this.updateStreamButton();
            this.widgets.forEach(this.sync, this);
        }
    },

    sync : function(widget) {
        widget.setObject(this.emitter);
        widget.sync();
    },

    addWidget : function(widget) {
        widget.appendTo(this.rootNode);
        this.widgets.push(widget);
    },
});