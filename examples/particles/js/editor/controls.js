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
            var emitter = new me.ParticleEmitter(x, y, params);
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

            var index = (select.selectedIndex === -1) ? this.emitters.length - 1 : select.selectedIndex;
            this.selectEmitter(this.emitters[index]);
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
            this.syncId = null;
            this.rootNode = container;
            var widget;

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

            this.addWidget(new pe.NumberInputWidget("z", 0, 100, 1));
            this.addWidget(new pe.BooleanInputWidget("onlyInViewport"));
            this.addWidget(new pe.BooleanInputWidget("floating"));
            this.addWidget(new pe.NumberInputWidget("framesToSkip", 0, 5, 1));

            this.addCategorySeparator("emitter properties");
            this.addWidget(new pe.ShapeWidget());

            widget = new pe.NumberInputWidget("width", 0, 800, 1);
            widget.property.setValue = function(value) {
                var object = this.object;
                if (object.width !== value) {
                    object.resize(value, object.height);
                    me.event.publish("propertyChanged", [ object ]);
                }
            };
            this.addWidget(widget);

            widget = new pe.NumberInputWidget("height", 0, 600, 1);
            widget.property.setValue = function(value) {
                var object = this.object;
                if (object.height !== value) {
                    object.resize(object.width, value);
                    me.event.publish("propertyChanged", [ object ]);
                }
            };
            this.addWidget(widget);
            this.addWidget(new pe.NumberInputWidget("totalParticles", 0, 500, 1));
            this.addWidget(new pe.NumberInputWidget("maxParticles", 0, 50, 1));
            this.addWidget(new pe.NumberInputWidget("frequency", 1, 100, 1));
            this.addWidget(new pe.NumberInputWidget("duration", 0, 10000, 100));

            this.addCategorySeparator("particle path");
            this.addWidget(new pe.VelocityWidget());
            this.addWidget(new pe.VelocityVariationWidget());
            this.addWidget(new pe.ForceWidget());

            this.addWidget(new pe.NumberInputWidget("minAngle", -Math.PI, Math.PI));
            this.addWidget(new pe.NumberInputWidget("maxAngle", -Math.PI, Math.PI));
            this.addWidget(new pe.NumberInputWidget("minSpeed", 0, 30));
            this.addWidget(new pe.NumberInputWidget("maxSpeed", 0, 30));
            this.addWidget(new pe.NumberInputWidget("gravity", -5, 5));
            this.addWidget(new pe.NumberInputWidget("wind", -5, 5));

            this.addCategorySeparator("particle properties");
            this.addWidget(new pe.ImageSelectionWidget("image"));
            this.addWidget(new pe.NumberInputWidget("minLife", 0, 10000, 100));
            this.addWidget(new pe.NumberInputWidget("maxLife", 0, 10000, 100));
            this.addWidget(new pe.NumberInputWidget("minRotation", -Math.PI, Math.PI));
            this.addWidget(new pe.NumberInputWidget("maxRotation", -Math.PI, Math.PI));
            this.addWidget(new pe.NumberInputWidget("minStartScale", 0, 5));
            this.addWidget(new pe.NumberInputWidget("maxStartScale", 0, 5));
            this.addWidget(new pe.NumberInputWidget("minEndScale", 0, 5));
            this.addWidget(new pe.NumberInputWidget("maxEndScale", 0, 5));
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
            if (this.emitter === emitter && this.syncId === null) {
                this.syncId = setTimeout(this.doSync.bind(this), 50);
            }
        },

        doSync : function() {
            this.syncId = null;
            this.updateStreamButton();
            this.widgets.forEach(this.sync, this);
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
            this.syncId = null;
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
            if (this.emitter === emitter && this.syncId === null) {
                this.syncId = setTimeout(this.generateCode.bind(this), 100);
            }
        },
        generateCode : function() {
            var emitter = this.emitter;
            if (emitter) {
                var defaults = me.ParticleEmitterSettings;
                var code = [];
                var settings = [];
                code.push("var x = me.game.viewport.getWidth() / 2;");
                code.push("var y = me.game.viewport.getHeight() / 2;");
                if (emitter.image !== defaults.image) {
                    code.push("var image = me.loader.getImage('" + this.getImageName() + "');");
                    settings.push("    image: image");
                }
                for ( var i in defaults) {
                    if (defaults.hasOwnProperty(i) && i !== "image" && emitter[i] !== defaults[i]) {
                        settings.push("    " + i + ": " + emitter[i]);
                    }
                }
                if (settings.length > 0) {
                    code.push("var emitter = new me.ParticleEmitter(x, y, {");
                    code.push(settings.join(",\n"));
                    code.push("});");
                } else {
                    code.push("var emitter = new me.ParticleEmitter(x, y);");
                }
                code.push("emitter.name = '" + emitter.name + "';");
                code.push("emitter.z = " + emitter.z + ";");
                code.push("me.game.world.addChild(emitter);");
                code.push("me.game.world.addChild(emitter.container);");
                code.push("emitter.streamParticles();");
                this.output.value = code.join("\n");
            } else {
                this.output.value = "";
            }
            this.syncId = null;
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