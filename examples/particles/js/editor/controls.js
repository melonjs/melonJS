(function() {
    var pe = game.ParticleEditor = game.ParticleEditor || {};

    pe.EmitterList = me.Object.extend({
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
            for ( var emitters = this.emitters, i = emitters.length, obj; i--, (obj = emitters[i]);) {
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
            emitter.pos.z = 10;
            me.game.world.addChild(emitter);
            emitter.streamParticles();
            this.addEmitter(emitter);
            this.selectEmitter(emitter);
            return emitter;
        },

        destroyEmitter : function() {
            var emitter = this.emitters[this.emitterList.selectedIndex];
            if (emitter) {
                this.removeEmitter(emitter);
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
            for ( var emitters = this.emitters, i = emitters.length, obj; i--, (obj = emitters[i]);) {
                if (obj === emitter) {
                    emitters.splice(i, 1);
                    this.updateList();
                    break;
                }
            }
        },

        selectEmitter : function(emitter) {
            this.emitterList.selectedIndex = -1;
            for ( var emitters = this.emitters, i = emitters.length, obj; i--, (obj = emitters[i]);) {
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

            for (var i = 0, emitters = this.emitters, length = emitters.length, emitter; i < length; ++i) {
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

            for (var j = options.length, obj; j--, (obj = options[j]);) {
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

    pe.EmitterController = me.Object.extend({
        init : function(container) {
            this.widgets = [];
            this.ingameWidgets = [];
            this.syncId = null;
            this.rootNode = container;
            var widget;

            this.addCategorySeparator("controls");
            this.addControlButtons();

            this.addCategorySeparator("ingame widgets");
            this.addWidgetButtons();
            this.addWidget(new pe.ShapeWidget(), true);
            this.addWidget(new pe.VelocityWidget(), true);
            this.addWidget(new pe.VelocityVariationWidget(), true);
            this.addWidget(new pe.ForceWidget(), true);

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
            };
            this.addWidget(widget);

            this.addWidget(new pe.NumberInputWidget("z", {
                min : 0,
                sliderMax : 100,
                step : 1
            }));
            this.addWidget(new pe.BooleanInputWidget("onlyInViewport"));
            this.addWidget(new pe.BooleanInputWidget("floating"));
            this.addWidget(new pe.NumberInputWidget("framesToSkip", {
                min : 0,
                sliderMax : 5,
                step : 1
            }));

            this.addCategorySeparator("emitter properties");
            widget = new pe.NumberInputWidget("width", {
                min : 0,
                sliderMax : 800,
                step : 1
            });
            widget.property.setValue = function(value) {
                var object = this.object;
                if (object.width !== value) {
                    object.resize(value, object.height);
                    me.event.publish("propertyChanged", [ object ]);
                }
            };
            this.addWidget(widget);

            widget = new pe.NumberInputWidget("height", {
                min : 0,
                sliderMax : 600,
                step : 1
            });
            widget.property.setValue = function(value) {
                var object = this.object;
                if (object.height !== value) {
                    object.resize(object.width, value);
                    me.event.publish("propertyChanged", [ object ]);
                }
            };
            this.addWidget(widget);
            this.addWidget(new pe.NumberInputWidget("totalParticles", {
                min : 1,
                sliderMax : 500,
                step : 1
            }));
            this.addWidget(new pe.NumberInputWidget("maxParticles", {
                min : 1,
                sliderMax : 100,
                step : 1
            }));
            this.addWidget(new pe.NumberInputWidget("frequency", {
                min : 1,
                sliderMax : 100,
                step : 1
            }));
            this.addWidget(new pe.NumberInputWidget("duration", {
                min : 0,
                sliderMax : 10000,
                step : 100
            }));

            this.addCategorySeparator("particle path");
            this.addWidget(new pe.NumberInputWidget("angle", {
                min : -Math.PI,
                max : Math.PI,
            }));
            this.addWidget(new pe.NumberInputWidget("angleVariation", {
                min : 0,
                max : Math.PI,
            }));
            this.addWidget(new pe.NumberInputWidget("speed", {
                min : 0,
                sliderMax : 30,
            }));
            this.addWidget(new pe.NumberInputWidget("speedVariation", {
                min : 0,
                sliderMax : 30,
            }));
            this.addWidget(new pe.NumberInputWidget("gravity", {
                sliderMin : -5,
                sliderMax : 5,
            }));
            this.addWidget(new pe.NumberInputWidget("wind", {
                sliderMin : -5,
                sliderMax : 5,
            }));

            this.addCategorySeparator("particle properties");
            this.addWidget(new pe.ImageSelectionWidget("image"));
            this.addWidget(new pe.NumberInputWidget("minLife", {
                min : 0,
                sliderMax : 10000,
                step : 100
            }));

            this.addWidget(new pe.NumberInputWidget("maxLife", {
                min : 0,
                sliderMax : 10000,
                step : 100
            }));

            this.addWidget(new pe.NumberInputWidget("minRotation", {
                min : -Math.PI,
                max : Math.PI,
            }));
            this.addWidget(new pe.NumberInputWidget("maxRotation", {
                min : -Math.PI,
                max : Math.PI,
            }));
            this.addWidget(new pe.NumberInputWidget("minStartScale", {
                min : 0,
                sliderMax : 5,
            }));
            this.addWidget(new pe.NumberInputWidget("maxStartScale", {
                min : 0,
                sliderMax : 5,
            }));
            this.addWidget(new pe.NumberInputWidget("minEndScale", {
                min : 0,
                sliderMax : 5,
            }));
            this.addWidget(new pe.NumberInputWidget("maxEndScale", {
                min : 0,
                sliderMax : 5,
            }));
            this.addWidget(new pe.BooleanInputWidget("followTrajectory"));
            this.addWidget(new pe.BooleanInputWidget("textureAdditive"));

            me.event.subscribe("propertyChanged", this.onChange.bind(this));

            this.ingameWidgets.forEach(this.showIngameWidgets);
        },

        addControlButtons : function() {
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

        addWidgetButtons : function() {
            var buttonContainer = document.createElement("div");
            buttonContainer.classList.add("buttons");
            this.rootNode.appendChild(buttonContainer);

            var showButton = this.showButton = document.createElement("input");
            showButton.value = "show all";
            showButton.setAttribute("type", "button");
            showButton.addEventListener("click", this.ingameWidgets.forEach.bind(this.ingameWidgets, this.showIngameWidgets));
            buttonContainer.appendChild(showButton);

            var hideButton = document.createElement("input");
            hideButton.value = "hide all";
            hideButton.setAttribute("type", "button");
            hideButton.addEventListener("click", this.ingameWidgets.forEach.bind(this.ingameWidgets, this.hideIngameWidgets));
            buttonContainer.appendChild(hideButton);
        },

        showIngameWidgets : function(widget) {
            widget.show();
        },

        hideIngameWidgets : function(widget) {
            widget.hide();
        },

        addCategorySeparator : function(label) {
            var separator = document.createElement("div");
            separator.classList.add("category");
            separator.appendChild(document.createTextNode(label));
            this.rootNode.appendChild(separator);
        },

        controlStream : function(/*event*/) {
            if (!this.emitter.isRunning()) {
                this.emitter.streamParticles();
            } else {
                this.emitter.stopStream();
            }
            this.updateStreamButton();
        },

        controlBurst : function(/*event*/) {
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

        addWidget : function(widget, ingame) {
            widget.appendTo(this.rootNode);
            this.widgets.push(widget);
            if (ingame) {
                this.ingameWidgets.push(widget);
            }
        },
    });

    pe.CodeGenerator = me.Object.extend({
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
                code.push("emitter.pos.z = " + emitter.pos.z + ";");
                code.push("me.game.world.addChild(emitter);");
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
