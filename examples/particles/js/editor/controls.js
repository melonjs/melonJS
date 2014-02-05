(function() {
    var pe = game.ParticleEditor = game.ParticleEditor || {};

    pe.EmitterList = Object.extend({
        init : function(emitterController, container) {
            this.emitterController = emitterController;
            this.emitters = [];
            this.rootNode = container;

            var separator = document.createElement("div");
            separator.classList.add("category");
            separator.appendChild(document.createTextNode("emitter list"));
            this.rootNode.appendChild(separator);

            var select = this.emitterList = document.createElement("select");
            select.setAttribute("size", 10);
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
            var x = me.game.viewport.getWidth() / 2;
            var y = me.game.viewport.getHeight() / 2;
            var image = me.loader.getImage(game.resources[0].name);
            var emitter = new me.ParticleEmitter(x, y, image);
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
                    if (obj.remove) {
                        obj.remove();
                    } else if (obj.removeNode) {
                        obj.removeNode(true);
                    } else {
                        console.warn("cannot remove DOM element");
                    }
                }
            }

            if (select.selectedIndex === -1) {
                this.selectEmitter(this.emitters[this.emitters.length - 1]);
            }
        },

        onChange : function() {
            var emitter = this.emitters[this.emitterList.selectedIndex];
            this.emitterController.setEmitter(emitter || null);
            me.event.publish("emitterChanged", [ emitter ]);
        }
    });

    pe.EmitterController = Object.extend({
        init : function(container) {
            this.widgets = [];
            var widget;
            this.rootNode = container;

            this.addCategorySeparator("controls");
            this.addButtons();

            this.addCategorySeparator("general");

            widget = new pe.TextInputWidget("name");
            widget.property.setValue = function(value) {
                if (!this.object) {
                    return false;
                }
                var object = this._getNestedObject(), propertyName = this.propertyName;
                if (object[propertyName] !== value) {
                    object[propertyName] = value;
                    game.EmitterList.updateList();
                    me.event.publish("propertyChanged", [ this.object ]);
                    return true;
                }
                return false;
            };
            widget.sync = function() {
                var value = this.property.getValue() || "";
                if (value !== this.input.value) {
                    this.input.value = value;
                    game.EmitterList.updateList();
                }
            }
            this.addWidget(widget);

            this.addWidget(new pe.IntegerInputWidget("z"));
            this.addWidget(new pe.BooleanInputWidget("onlyInViewport"));
            this.addWidget(new pe.BooleanInputWidget("floating"));
            this.addWidget(new pe.IntegerInputWidget("framesToSkip"));

            this.addCategorySeparator("emitter properties");
            this.addWidget(new pe.ShapeWidget());

            widget = new pe.IntegerInputWidget("width");
            widget.property.setValue = function(value) {
                var object = this.object;
                if (object.width !== value) {
                    object.resize(value, object.height);
                    me.event.publish("propertyChanged", [ object ]);
                }
            };
            this.addWidget(widget);

            widget = new pe.IntegerInputWidget("height");
            widget.property.setValue = function(value) {
                var object = this.object;
                if (object.height !== value) {
                    object.resize(object.width, value);
                    me.event.publish("propertyChanged", [ object ]);
                }
            };
            this.addWidget(widget);
            this.addWidget(new pe.IntegerInputWidget("totalParticles"));
            this.addWidget(new pe.IntegerInputWidget("maxParticles"));
            this.addWidget(new pe.IntegerInputWidget("frequency"));
            this.addWidget(new pe.IntegerInputWidget("duration"));

            this.addCategorySeparator("particle path");
            this.addWidget(new pe.VelocityWidget());
            this.addWidget(new pe.VelocityVariationWidget());
            this.addWidget(new pe.ForceWidget());

            this.addWidget(new pe.FloatInputWidget("minAngle"));
            this.addWidget(new pe.FloatInputWidget("maxAngle"));
            this.addWidget(new pe.FloatInputWidget("minSpeed"));
            this.addWidget(new pe.FloatInputWidget("maxSpeed"));
            this.addWidget(new pe.FloatInputWidget("gravity"));
            this.addWidget(new pe.FloatInputWidget("wind"));

            this.addCategorySeparator("particle properties");
            this.addWidget(new pe.ImageSelectionWidget("image"));
            this.addWidget(new pe.IntegerInputWidget("minLife"));
            this.addWidget(new pe.IntegerInputWidget("maxLife"));
            this.addWidget(new pe.FloatInputWidget("minRotation"));
            this.addWidget(new pe.FloatInputWidget("maxRotation"));
            this.addWidget(new pe.FloatInputWidget("minStartScale"));
            this.addWidget(new pe.FloatInputWidget("maxStartScale"));
            this.addWidget(new pe.FloatInputWidget("minEndScale"));
            this.addWidget(new pe.FloatInputWidget("maxEndScale"));
            this.addWidget(new pe.BooleanInputWidget("followTrajectory"));
            this.addWidget(new pe.BooleanInputWidget("textureAdditive"));

            me.event.subscribe("propertyChanged", this.onChange.bind(this));
        },

        addButtons : function() {
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
        },

        addCategorySeparator : function(label) {
            var separator = document.createElement("div");
            separator.classList.add("category");
            separator.appendChild(document.createTextNode(label));
            this.rootNode.appendChild(separator);
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

    pe.CodeGenerator = Object.extend({
        init : function(controller, container) {
            this.emitter = null;
            me.event.subscribe("propertyChanged", this.onChange.bind(this));
            me.event.subscribe("emitterChanged", this.setEmitter.bind(this));

            this.rootNode = container;

            var separator = document.createElement("div");
            separator.classList.add("category");
            separator.appendChild(document.createTextNode("source code"));
            this.rootNode.appendChild(separator);

            var output = this.output = document.createElement("textarea");
            this.rootNode.appendChild(output);
        },
        setEmitter : function(emitter) {
            this.emitter = emitter;
            this.onChange(emitter);
        },
        onChange : function(emitter) {
            if (this.emitter === emitter) {
                var code = this.generateCode();
                 this.output.value = code;
            }
        },
        generateCode : function() {
            var emitter = this.emitter;
            if (emitter) {
                var code = [];
                code.push("var x = me.game.viewport.getWidth() / 2;");
                code.push("var y = me.game.viewport.getHeight() / 2;");
                code.push("var image = me.loader.getImage('" + this.getImageName() + "');");
                code.push("var emitter = new me.ParticleEmitter(x, y, image);");
                code.push("emitter.reset({");
                code.push("    width: " + emitter.width + ",");
                code.push("    height: " + emitter.height + ",");
                code.push("    totalParticles: " + emitter.totalParticles + ",");
                code.push("    minAngle: " + emitter.minAngle + ",");
                code.push("    maxAngle: " + emitter.maxAngle + ",");
                code.push("    minLife: " + emitter.minLife + ",");
                code.push("    maxLife: " + emitter.maxLife + ",");
                code.push("    minSpeed: " + emitter.minSpeed + ",");
                code.push("    maxSpeed: " + emitter.maxSpeed + ",");
                code.push("    minRotation: " + emitter.minRotation + ",");
                code.push("    maxRotation: " + emitter.maxRotation + ",");
                code.push("    minStartScale: " + emitter.minStartScale + ",");
                code.push("    maxStartScale: " + emitter.maxStartScale + ",");
                code.push("    minEndScale: " + emitter.minEndScale + ",");
                code.push("    maxEndScale: " + emitter.maxEndScale + ",");
                code.push("    gravity: " + emitter.gravity + ",");
                code.push("    wind: " + emitter.wind + ",");
                code.push("    followTrajectory: " + emitter.followTrajectory + ",");
                code.push("    textureAdditive: " + emitter.textureAdditive + ",");
                code.push("    onlyInViewport: " + emitter.onlyInViewport + ",");
                code.push("    floating: " + emitter.floating + ",");
                code.push("    maxParticles: " + emitter.maxParticles + ",");
                code.push("    frequency: " + emitter.frequency + ",");
                code.push("    duration: " + emitter.duration + ",");
                code.push("    framesToSkip: " + emitter.framesToSkip + "");
                code.push("});");
                code.push("emitter.name = '" + emitter.name + "';");
                code.push("emitter.z = " + emitter.z + ";");
                code.push("me.game.world.addChild(emitter);");
                code.push("me.game.world.addChild(emitter.container);");
                code.push("emitter.streamParticles();");
                return code.join("\n");
            }
            return "";
        },
        getImageName : function() {
            var image = this.emitter.image, imageName = "";
            if (image) {
                var resourceList = game.resources;
                for ( var i = 0, length = resourceList.length, resource; i < length; ++i) {
                    resource = resourceList[i];
                    if (image === me.loader.getImage(resource.name)) {
                        imageName = resource.name;
                        break;
                    }
                }
            }
            return imageName;
        }
    });
})();