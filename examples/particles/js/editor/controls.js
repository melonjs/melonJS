game.ParticleEditor = game.ParticleEditor || {};
game.ParticleEditor.EmitterController = Object.extend({
    init : function(emitter, containerId) {
        this.emitter = emitter;
        this.widgets = [];
        this.rootNode = document.getElementById(containerId);
        this.rootNode.classList.add("controls");
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

        this.onChange(emitter);
        me.event.subscribe("emitterChanged", this.onChange.bind(this));
    },
    onChange : function(emitter) {
        if (this.emitter === emitter) {
            this.widgets.forEach(this.sync);
        }
    },
    sync : function(widget) {
        widget.sync();
    },
    addWidget : function(widget) {
        widget.appendTo(this.rootNode);
        this.widgets.push(widget);
    },
});