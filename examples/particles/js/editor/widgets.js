(function() {
    var pe = game.ParticleEditor = game.ParticleEditor || {};

    pe.PropertyWrapper = me.Object.extend({
        init : function(propertyName) {
            this.object = null;
            this.propertyPath = propertyName.split(".");
            this.propertyName = this.propertyPath.pop();
        },
        _getNestedObject : function() {
            var object = this.object;
            for ( var i = 0, propertyPath = this.propertyPath, length = propertyPath.length; i < length; ++i) {
                object = object[propertyPath[i]];
            }
            return object;
        },
        getValue : function() {
            if (!this.object) {
                return;
            }
            var object = this._getNestedObject();
            return object[this.propertyName];
        },
        setValue : function(value) {
            if (!this.object) {
                return false;
            }
            var object = this._getNestedObject(), propertyName = this.propertyName;
            if (object[propertyName] !== value) {
                object[propertyName] = value;
                me.event.publish("propertyChanged", [ this.object ]);
                return true;
            }
            return false;
        },
    });

    pe.WidgetBase = me.Object.extend({
        init : function(propertyName) {
            this.property = new pe.PropertyWrapper(propertyName);
            this.rootNode = null;
        },
        addInput : function(label, input) {
            if (!this.rootNode) {
                this.rootNode = document.createElement("div");
            }
            var labelNode = document.createElement("label");
            labelNode.appendChild(document.createTextNode(label.replace(/([A-Z])/g, " $1").toLowerCase()));
            labelNode.appendChild(input);
            this.rootNode.appendChild(labelNode);
        },
        setObject : function(object) {
            this.property.object = object;
        },
        sync : function() {
            console.warn("sync is not implemented yet.");
        },
        appendTo : function(container) {
            if (this.rootNode) {
                container.appendChild(this.rootNode);
            }
        }
    });

    pe.NumberInputWidget = pe.WidgetBase.extend({
        init : function(propertyName, settings) {
            this._super(pe.WidgetBase, "init", [propertyName]);
            settings = settings || {};

            var container = document.createElement("div");
            container.classList.add("slider");

            var slider = this.slider = document.createElement("input");
            var input = this.input = document.createElement("input");
            slider.setAttribute("type", "range");
            input.setAttribute("type", "number");

            if (typeof settings.step === "number") {
                slider.setAttribute("step", settings.step);
                input.setAttribute("step", (settings.step % 1 > 0) ? "any" : "1");
            } else {
                slider.setAttribute("step", "any");
                input.setAttribute("step", "any");
            }

            var min = (typeof settings.min === "number") ? settings.min : -Infinity;
            var max = (typeof settings.max === "number") ? settings.max : Infinity;
            input.setAttribute("min", min);
            input.setAttribute("max", max);

            var sliderMin = (typeof settings.sliderMin === "number") ? settings.sliderMin : -Infinity;
            var sliderMax = (typeof settings.sliderMax === "number") ? settings.sliderMax : Infinity;
            slider.setAttribute("min", Math.max(min, sliderMin));
            slider.setAttribute("max", Math.min(max, sliderMax));

            slider.addEventListener("input", this.onSliderChange.bind(this));
            slider.addEventListener("change", this.onSliderChange.bind(this));
            input.addEventListener("change", this.onChange.bind(this));

            container.appendChild(slider);
            container.appendChild(input);

            this.addInput(propertyName, container);
        },
        onSliderChange : function() {
            if (this.slider.validity.valid) {
                this.property.setValue(parseFloat(this.slider.value));
            }
        },
        onChange : function() {
            if (this.input.validity.valid) {
                this.property.setValue(parseFloat(this.input.value));
            }
        },
        sync : function() {
            var value = this.property.getValue();
            this.input.value = value;
            this.slider.value = value;
        }
    });

    pe.TextInputWidget = pe.WidgetBase.extend({
        init : function(propertyName) {
            this._super(pe.WidgetBase, "init", [propertyName]);

            var input = this.input = document.createElement("input");
            input.setAttribute("type", "text");
            input.addEventListener("change", this.onChange.bind(this));
            this.addInput(propertyName, input);
        },
        onChange : function() {
            if (this.input.validity.valid) {
                this.property.setValue(this.input.value);
            }
        },
        sync : function() {
            this.input.value = this.property.getValue() || "";
        }
    });

    pe.BooleanInputWidget = pe.WidgetBase.extend({
        init : function(propertyName) {
            this._super(pe.WidgetBase, "init", [propertyName]);

            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            this.addInput(propertyName, input);
        },
        onChange : function() {
            this.property.setValue(this.input.checked);
        },
        sync : function() {
            this.input.checked = this.property.getValue();
        }
    });

    pe.ImageSelectionWidget = pe.WidgetBase.extend({
        init : function(propertyName, resourceList) {
            this._super(pe.WidgetBase, "init", [propertyName]);

            var select = this.select = document.createElement("select");
            select.addEventListener("change", this.onChange.bind(this));
            this.resourceList = resourceList = resourceList || game.resources || [];
            for ( var i = 0, length = resourceList.length, resource, option; i < length; ++i) {
                resource = resourceList[i];
                if (resource.type === "image") {
                    option = document.createElement("option");
                    option.setAttribute("value", resource.name);
                    option.appendChild(document.createTextNode(resource.name));
                    select.appendChild(option);
                }
            }
            this.addInput(propertyName, select);
        },
        onChange : function() {
            var image = me.loader.getImage(this.select.value);
            this.property.setValue(image);
        },
        sync : function() {
            var image = this.property.getValue();
            if (image) {
                var resourceList = this.resourceList;
                for ( var i = 0, length = resourceList.length, resource; i < length; ++i) {
                    resource = resourceList[i];
                    if (image === me.loader.getImage(resource.name)) {
                        this.select.selectedIndex = i;
                        break;
                    }
                }
            } else {
                this.select.selectedIndex = -1;
            }
        }
    });

    pe.ShapeWidget = pe.WidgetBase.extend({
        init : function() {
            this._super(pe.WidgetBase, "init", [""]);

            this.shape = new pe.ShapeWidget.Helper("rgba(255, 86, 86, 0.3)");
            this.dragHandler = new pe.DragHandler(new me.Color(255, 86, 86, 1));
            this.dragHandler.onDrag = this.onDrag.bind(this);

            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            this.addInput("shape widget", input);
        },
        setObject : function(object) {
            this.object = object;
        },
        onDrag : function(pos) {
            var object = this.object;
            if (object) {
                pos.sub(object.pos).clampSelf(0, Infinity);
                object.resize(pos.x, pos.y);
                me.event.publish("propertyChanged", [ object ]);
            }
        },
        onChange : function() {
            if (this.input.checked) {
                me.game.world.addChild(this.shape);
                this.dragHandler.enable();
            } else {
                me.game.world.removeChild(this.shape);
                this.dragHandler.disable();
            }
        },
        show : function() {
            if (!this.input.checked) {
                this.input.checked = true;
                this.onChange();
            }
        },
        hide : function() {
            if (this.input.checked) {
                this.input.checked = false;
                this.onChange();
            }
        },
        sync : function() {
            var object = this.object;
            if (object) {
                this.dragHandler.floating = this.shape.floating = object.floating;
                this.shape.setShape(object.pos, object.width, object.height);
                this.dragHandler.setPosition(object.pos.x + object.width, object.pos.y + object.height);
            }
        }
    });

    pe.ShapeWidget.Helper = me.Renderable.extend({
        init : function(color) {
            this._super(me.Renderable, "init", [0, 0, 0, 0]);
            this.pos.z = Infinity;
            this.color = color;
        },
        setShape : function(v, w, h) {
            this.resize(w, h);
            this.pos.set(v.x, v.y, this.pos.z);
            return this;
        },
        draw : function(renderer) {
            renderer.setColor(this.color);
            renderer.fillRect(this.left, this.top, this.width, this.height);
            renderer.setLineWidth(1);
            renderer.strokeRect(this.left, this.top, this.width, this.height);
        }
    });

    pe.DragHandler = me.Renderable.extend({
        init : function(color) {
            this.originalSize = 40;
            this.createGradients(color, this.originalSize);
            this._super(me.Renderable, "init", [0, 0, this.originalSize, this.originalSize]);
            this.pos.z = Infinity;
            this.dragging = false;
            this.grabOffset = new me.Vector2d(0, 0);

            this._startDrag = this.startDrag.bind(this);
            this._stopDrag = this.stopDrag.bind(this);
            this._drag = this.drag.bind(this);

            this.onDrag = function() {};

            me.input.registerPointerEvent("pointerup", me.game.viewport, this._stopDrag);
            me.input.registerPointerEvent("pointermove", me.game.viewport, this._drag);
        },
        createGradients : function(color, size) {
            var context = me.video.renderer.getContext();
            var bigGradient = this.bigGradient = context.createRadialGradient(0, 0, 0, 0, 0, size / 2);
            var smallGradient = this.smallGradient = context.createRadialGradient(0, 0, 0, 0, 0, size / 4);

            color.alpha = 0;
            bigGradient.addColorStop(0, color.toRGBA());
            smallGradient.addColorStop(0, color.toRGBA());

            color.alpha = 0.8;
            bigGradient.addColorStop(0.9, color.toRGBA());
            smallGradient.addColorStop(0.9, color.toRGBA());

            color.alpha = 0;
            bigGradient.addColorStop(1, color.toRGBA());
            smallGradient.addColorStop(1, color.toRGBA());

            this.color = bigGradient;
        },
        enable : function(container) {
            me.input.registerPointerEvent("pointerdown", this, this._startDrag);
            (container || me.game.world).addChild(this);
        },
        disable : function(container) {
            if (this.dragging) {
                this.stopDrag();
            }
            me.input.releasePointerEvent("pointerdown", this, this._startDrag);
            (container || this.ancestor || me.game.world).removeChild(this);
        },
        setPosition : function(x, y) {
            this.pos.set(x - (this.width / 2), y - (this.height / 2), this.pos.z);
        },
        startDrag : function(/*event*/) {
            this.dragging = true;
            this.color = this.smallGradient;

            var size = this.originalSize / 2;
            this.resize(size, size);
            size /= 2;
            this.translate(size, size);

            var mousepos = me.input.pointer.pos;
            var x = mousepos.x - this.pos.x;
            var y = mousepos.y - this.pos.y;
            this.grabOffset.set(x, y);
            return false;
        },
        stopDrag : function() {
            if (this.dragging) {
                this.dragging = false;
                this.color = this.bigGradient;
                var size = this.originalSize;
                this.resize(size, size);
                size /= -4;
                this.translate(size, size);
                return false;
            }
        },
        drag : function(/*event*/) {
            if (this.dragging) {
                var pos = me.input.pointer.pos.clone().sub(this.grabOffset);
                pos.x += (this.width / 2);
                pos.y += (this.height / 2);
                this.onDrag(pos);
                return false;
            }
        },
        draw : function(renderer) {
            renderer.save();
            var context = renderer.getContext();
            context.fillStyle = this.color;
            renderer.fillArc(this.pos.x, this.pos.y, this.width / 2, 0, Math.PI * 2);
            renderer.restore();
        }
    });

    pe.VectorWidget = pe.WidgetBase.extend({
        init : function(name, color) {
            this._super(pe.WidgetBase, "init", [""]);
            this.origin = new me.Vector2d(0, 0);
            this.vector = new me.Vector2d(0, 0);

            this.shape = new pe.VectorWidget.Helper(this, color);
            this.dragHandler = new pe.DragHandler(color);
            this.dragHandler.onDrag = this.onDrag.bind(this);

            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            this.addInput(name + " widget", input);
        },
        setObject : function(object) {
            this.object = object;
        },
        setVector : function(x, y) {
            this.vector.set(x, y);
            this.dragHandler.setPosition(this.origin.x + x, this.origin.y + y);
        },
        onDrag : function(pos) {
            var object = this.object;
            if (object) {
                pos.x -= object.pos.x + (object.width / 2);
                pos.y -= object.pos.y + (object.height / 2);
                var x = pos.x;
                var y = pos.y;
                if (x !== this.vector.x || y !== this.vector.y) {
                    this.onVectorChanged(pos);
                    this.setVector(x, y);
                    me.event.publish("propertyChanged", [ object ]);
                }
            }
        },
        onChange : function() {
            if (this.input.checked) {
                me.game.world.addChild(this.shape);
                this.dragHandler.enable();
            } else {
                me.game.world.removeChild(this.shape);
                this.dragHandler.disable();
            }
        },
        show : function() {
            if (!this.input.checked) {
                this.input.checked = true;
                this.onChange();
            }
        },
        hide : function() {
            if (this.input.checked) {
                this.input.checked = false;
                this.onChange();
            }
        },
        sync : function() {
            var object = this.object;
            if (object) {
                this.dragHandler.floating = this.shape.floating = object.floating;
                this.origin.set(object.pos.x + (object.width / 2), object.pos.y + (object.height / 2));
                this.onSync(object);
                this.shape.setShape(this.origin, this.vector.x, this.vector.y);
            }
        },
        onVectorChanged : function(/*vector*/) {
        },
        onSync : function(/*object*/) {
        }
    });

    pe.VectorWidget.Helper = me.Renderable.extend({
        init : function(widget, color) {
            this._super(me.Renderable, "init", [0, 0, 0, 0]);
            this.widget = widget;
            this.pos.z = Infinity;
            this.color = color.toRGBA();
        },
        setShape : function(v, w, h) {
            var x = w < 0 ? v.x + w : v.x;
            var y = h < 0 ? v.y + h : v.y;
            this.pos.set(x, y, this.pos.z);
            this.resize(Math.abs(w), Math.abs(h));
            return this;
        },
        draw : function(renderer) {
            var origin = this.widget.origin;
            var vector = this.widget.vector;
            renderer.save();
            renderer.setColor(this.color);
            renderer.setLineWidth(5);
            renderer.strokeLine(
                origin.x,
                origin.y,
                origin.x + vector.x,
                origin.y + vector.y
            );
            renderer.restore();
        }
    });

    pe.VelocityWidget = pe.VectorWidget.extend({
        init : function() {
            this._super(pe.VectorWidget, "init", ["velocity", new me.Color(229, 216, 47, 0.3)]);
            this.scaler = 30;
        },
        onVectorChanged : function(vector) {
            var object = this.object;
            object.speed = vector.length() / this.scaler;
            object.angle = Math.atan2(vector.x, vector.y) - Math.PI / 2;
            if (object.angle < -Math.PI) {
                object.angle += 2 * Math.PI;
            }
        },
        onSync : function(object) {
            var length = object.speed * this.scaler;
            var angle = object.angle;
            this.setVector(Math.cos(angle) * length, -Math.sin(angle) * length);
        }
    });

    pe.ForceWidget = pe.VectorWidget.extend({
        init : function() {
            this._super(pe.VectorWidget, "init", ["force", new me.Color(79, 214, 72, 0.3)]);
            this.scaler = 300;
        },
        onVectorChanged : function(vector) {
            var object = this.object;
            object.wind = vector.x / this.scaler;
            object.gravity = vector.y / this.scaler;
        },
        onSync : function(object) {
            this.setVector(object.wind * this.scaler, object.gravity * this.scaler);
        }
    });

    pe.VelocityVariationWidget = pe.WidgetBase.extend({
        init : function() {
            this._super(pe.WidgetBase, "init", [""]);
            this.scaler = 30;

            this.shape = new pe.VelocityVariationWidget.Helper(new me.Color(105, 190, 255, 0.3));
            this.dragHandler = new pe.DragHandler(new me.Color(150, 150, 255, 1));
            this.dragHandler.onDrag = this.onDrag.bind(this);

            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            this.addInput("velocity variation widget", input);
        },
        onDrag : function(pos) {
            var object = this.object;
            if (object) {
                pos.x -= object.pos.x + (object.width / 2);
                pos.y -= object.pos.y + (object.height / 2);
                var variation = object.angle - Math.atan2(-pos.y, pos.x);
                if (variation < -Math.PI / 2) {
                    variation += 2 * Math.PI;
                }
                object.angleVariation = variation.clamp(0, Math.PI);
                variation = (pos.length() / this.scaler) - object.speed;
                object.speedVariation = variation < 0 ? 0 : variation;
                me.event.publish("propertyChanged", [ object ]);
            }
        },
        onChange : function() {
            if (this.input.checked) {
                me.game.world.addChild(this.shape);
                this.dragHandler.enable();
            } else {
                me.game.world.removeChild(this.shape);
                this.dragHandler.disable();
            }
        },
        show : function() {
            if (!this.input.checked) {
                this.input.checked = true;
                this.onChange();
            }
        },
        hide : function() {
            if (this.input.checked) {
                this.input.checked = false;
                this.onChange();
            }
        },
        setObject : function(object) {
            this.object = object;
        },
        sync : function() {
            var object = this.object;
            if (object) {
                this.shape.floating = object.floating;
                this.dragHandler.floating = object.floating;

                this.shape.set(object);
                var angle = object.angle - object.angleVariation;
                var radius = (object.speed + object.speedVariation) * this.scaler;
                var x = object.pos.x + (object.width / 2) + Math.cos(angle) * radius;
                var y = object.pos.y + (object.height / 2) - Math.sin(angle) * radius;
                this.dragHandler.setPosition(x, y);
            }
        }
    });

    pe.VelocityVariationWidget.Helper = me.Renderable.extend({
        init : function(color) {
            this._super(me.Renderable, "init", [0, 0, 0, 0]);
            this.color = color.toRGBA();
            this.startAngle = 0;
            this.endAngle = 0;
            this.minRadius = 0;
            this.maxRadius = 0;
            this.scaler = 30;
            this.pos.z = Infinity;
        },
        set : function(object) {
            this.pos.set(object.pos.x + (object.width / 2), object.pos.y + (object.height / 2), this.pos.z);
            this.startAngle = -(object.angle - object.angleVariation);
            this.endAngle = -(object.angle + object.angleVariation);
            this.minRadius = (object.speed - object.speedVariation) * this.scaler;
            this.maxRadius = (object.speed + object.speedVariation) * this.scaler;
        },
        draw : function(renderer) {
            var x = this.pos.x,
                y = this.pos.y,
                context = renderer.getContext();

            context.strokeStyle = this.color;
            context.fillStyle = this.color;
            context.beginPath();
            context.arc(x, y, this.maxRadius, this.startAngle, this.endAngle, true);
            if (this.minRadius < 0) {
                context.arc(x, y, -this.minRadius, this.endAngle + Math.PI, this.startAngle + Math.PI);
            } else {
                context.arc(x, y, this.minRadius, this.endAngle, this.startAngle);
            }
            context.closePath();
            context.fill();
            context.stroke();
        }
    });
})();
