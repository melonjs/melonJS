(function() {
    var pe = game.ParticleEditor = game.ParticleEditor || {};

    pe.PropertyWrapper = Object.extend({
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

    pe.WidgetBase = Object.extend({
        init : function(propertyName) {
            this.property = new pe.PropertyWrapper(propertyName);
            this.rootNode = null;
        },
        addInput : function(label, input) {
            if (!this.rootNode) {
                this.rootNode = document.createElement("div");
            }
            var labelNode = document.createElement("label");
            labelNode.appendChild(document.createTextNode(label.replace(/([A-Z])/g, ' $1').toLowerCase()))
            labelNode.appendChild(input)
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
            this.parent(propertyName);
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
                this.property.setValue(this.slider.value);
            }
        },
        onChange : function() {
            if (this.input.validity.valid) {
                this.property.setValue(this.input.value);
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
            this.parent(propertyName);

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
            this.parent(propertyName);

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
            this.parent(propertyName);

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
            this.parent("");

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
                object.resize(pos.x * 2, pos.y * 2);
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
                this.dragHandler.setPosition(object.pos.x + object.hWidth, object.pos.y + object.hHeight);
            }
        }
    });

    pe.ShapeWidget.Helper = me.Renderable.extend({
        init : function(color) {
            this.parent(new me.Vector2d(0, 0), 0, 0);
            this.z = Infinity;
            this.color = color;
        },
        setShape : function(v, w, h) {
            this.resize(w, h);
            this.pos.set(v.x - this.hWidth, v.y - this.hHeight);
            return this;
        },
        draw : function(context) {
            context.fillStyle = this.color;
            context.strokeStyle = this.color;
            context.fillRect(this.left, this.top, this.width, this.height);
            context.strokeRect(this.left, this.top, this.width, this.height);
        }
    });

    pe.DragHandler = me.Renderable.extend({
        init : function(color) {
            this.originalSize = 40;
            this.createGradients(color, this.originalSize);
            this.parent(new me.Vector2d(0, 0), this.originalSize, this.originalSize);
            this.z = Infinity;
            this.dragging = false;
            this.grabOffset = new me.Vector2d(0, 0);

            this._startDrag = this.startDrag.bind(this);
            this._stopDrag = this.stopDrag.bind(this);
            this._drag = this.drag.bind(this);
            me.input.registerPointerEvent("mouseup", me.game.viewport, this._stopDrag);
            me.input.registerPointerEvent("mousemove", me.game.viewport, this._drag);
        },
        createGradients : function(color, size) {
            var context = me.video.getSystemContext();
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
            me.input.registerPointerEvent("mousedown", this, this._startDrag);
            // me.input.registerPointerEvent("mouseup", me.game.viewport, this._stopDrag);
            // me.input.registerPointerEvent("mousemove", me.game.viewport, this._drag);
            (container || me.game.world).addChild(this);
        },
        disable : function(container) {
            if (this.dragging) {
                this.stopDrag();
            }
            me.input.releasePointerEvent("mousedown", this, this._startDrag);
            // me.input.releasePointerEvent("mouseup", me.game.viewport, this._stopDrag);
            // me.input.releasePointerEvent("mousemove", me.game.viewport, this._drag);
            (container || this.ancestor || me.game.world).removeChild(this);
        },
        setPosition : function(x, y) {
            this.pos.set(x - this.hWidth, y - this.hHeight);
        },
        startDrag : function(event) {
            this.dragging = true;
            this.color = this.smallGradient;

            var size = this.originalSize / 2;
            this.resize(size, size);
            size /= 2;
            this.translate(size, size);

            var mousepos = me.input.mouse.pos;
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
        drag : function(event) {
            if (this.dragging) {
                var pos = me.input.mouse.pos.clone().sub(this.grabOffset);
                pos.x += this.hWidth;
                pos.y += this.hHeight;
                this.onDrag(pos);
                return false;
            }
        },
        onDrag : function(pos) {
        },
        draw : function(context, rect) {
            context.save();
            // context.strokeStyle = this.color;
            context.fillStyle = this.color;
            context.beginPath();
            context.translate(this.pos.x + this.hWidth, this.pos.y + this.hHeight);
            context.arc(0, 0, this.hWidth, 0, Math.PI * 2);
            // context.stroke();
            // context.globalAlpha = 0.3;
            context.fill();
            context.closePath();
            context.restore();
        }
    });

    pe.VectorWidget = pe.WidgetBase.extend({
        init : function(name, color) {
            this.parent("");
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
                pos.sub(object.pos);
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
                this.origin.setV(object.pos);
                this.onSync(object);
                this.shape.setShape(this.origin, this.vector.x, this.vector.y);
            }
        },
        onVectorChanged : function(vector) {
        },
        onSync : function(object) {
        }
    });

    pe.VectorWidget.Helper = me.Renderable.extend({
        init : function(widget, color) {
            this.parent(new me.Vector2d(0, 0), 0, 0);
            this.widget = widget;
            this.z = Infinity;
            this.color = color.toRGBA();
        },
        setShape : function(v, w, h) {
            var x = w < 0 ? v.x + w : v.x;
            var y = h < 0 ? v.y + h : v.y;
            this.pos.set(x, y);
            this.resize(Math.abs(w), Math.abs(h));
            return this;
        },
        draw : function(context) {
            var origin = this.widget.origin;
            var vector = this.widget.vector;
            context.save();
            context.lineWidth = 5;
            context.strokeStyle = this.color;
            context.translate(origin.x, origin.y);
            context.beginPath();
            context.moveTo(0, 0);
            context.lineTo(vector.x, vector.y);
            context.stroke();
            context.closePath();
            context.restore();
        }
    });

    pe.VelocityWidget = pe.VectorWidget.extend({
        init : function() {
            this.parent("velocity", new me.Color(229, 216, 47, 0.3));
            this.scale = 30;
        },
        onVectorChanged : function(vector) {
            var object = this.object;
            var speedRange = (object.maxSpeed - object.minSpeed) / 2;
            var speed = vector.length() / this.scale;
            var angle = Math.atan2(vector.x, vector.y) - Math.PI / 2;
            var angleRange = (object.maxAngle - object.minAngle) / 2;

            object.minSpeed = Math.max(speed - speedRange, 0);
            object.maxSpeed = speed + speedRange;
            object.minAngle = angle - angleRange;
            object.maxAngle = angle + angleRange;
        },
        onSync : function(object) {
            var length = (object.minSpeed + (object.maxSpeed - object.minSpeed) / 2) * this.scale;
            var angle = object.minAngle + (object.maxAngle - object.minAngle) / 2;
            this.setVector(Math.cos(angle) * length, -Math.sin(angle) * length);
        }
    });

    pe.ForceWidget = pe.VectorWidget.extend({
        init : function() {
            this.parent("force", new me.Color(79, 214, 72, 0.3));
            this.scale = 300;
        },
        onVectorChanged : function(vector) {
            var object = this.object;
            object.wind = vector.x / this.scale;
            object.gravity = vector.y / this.scale;
        },
        onSync : function(object) {
            this.setVector(object.wind * this.scale, object.gravity * this.scale);
        }
    });

    pe.VelocityVariationWidget = pe.WidgetBase.extend({
        init : function() {
            this.parent("");
            this.scale = 30;

            this.shape = new pe.VelocityVariationWidget.Helper(new me.Color(105, 190, 255, 0.3));
            this.dragHandlerMinAngle = new pe.DragHandler(new me.Color(150, 150, 255, 1));
            this.dragHandlerMinAngle.onDrag = this.onDragMinAngle.bind(this);
            this.dragHandlerMaxAngle = new pe.DragHandler(new me.Color(80, 80, 255, 1));
            this.dragHandlerMaxAngle.onDrag = this.onDragMaxAngle.bind(this);
            this.dragHandlerMinSpeed = new pe.DragHandler(new me.Color(255, 200, 150, 1));
            this.dragHandlerMinSpeed.onDrag = this.onDragMinSpeed.bind(this);
            this.dragHandlerMaxSpeed = new pe.DragHandler(new me.Color(255, 120, 30, 1));
            this.dragHandlerMaxSpeed.onDrag = this.onDragMaxSpeed.bind(this);

            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            this.addInput("velocity variation widget", input);
        },
        onDragMinAngle : function(pos) {
            var object = this.object;
            if (object) {
                pos.sub(object.pos);
                object.minAngle = Math.atan2(-pos.y, pos.x);
                me.event.publish("propertyChanged", [ object ]);
            }
        },
        onDragMaxAngle : function(pos) {
            var object = this.object;
            if (object) {
                pos.sub(object.pos);
                object.maxAngle = Math.atan2(-pos.y, pos.x);
                me.event.publish("propertyChanged", [ object ]);
            }
        },
        onDragMinSpeed : function(pos) {
            var object = this.object;
            if (object) {
                pos.sub(object.pos);
                object.minSpeed = pos.length() / this.scale;
                me.event.publish("propertyChanged", [ object ]);
            }
        },
        onDragMaxSpeed : function(pos) {
            var object = this.object;
            if (object) {
                pos.sub(object.pos);
                object.maxSpeed = pos.length() / this.scale;
                me.event.publish("propertyChanged", [ object ]);
            }
        },
        onChange : function() {
            if (this.input.checked) {
                me.game.world.addChild(this.shape);
                this.dragHandlerMinAngle.enable();
                this.dragHandlerMaxAngle.enable();
                this.dragHandlerMinSpeed.enable();
                this.dragHandlerMaxSpeed.enable();
            } else {
                me.game.world.removeChild(this.shape);
                this.dragHandlerMinAngle.disable();
                this.dragHandlerMaxAngle.disable();
                this.dragHandlerMinSpeed.disable();
                this.dragHandlerMaxSpeed.disable();
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
                this.dragHandlerMinAngle.floating = object.floating;
                this.dragHandlerMaxAngle.floating = object.floating;
                this.dragHandlerMinSpeed.floating = object.floating;
                this.dragHandlerMaxSpeed.floating = object.floating;

                this.shape.set(object);
                var radius = (object.minSpeed + (object.maxSpeed - object.minSpeed) / 2) * this.scale;
                var x = object.pos.x + Math.cos(object.minAngle) * radius;
                var y = object.pos.y - Math.sin(object.minAngle) * radius;
                this.dragHandlerMinAngle.setPosition(x, y);
                x = object.pos.x + Math.cos(object.maxAngle) * radius;
                y = object.pos.y - Math.sin(object.maxAngle) * radius;
                this.dragHandlerMaxAngle.setPosition(x, y);

                var angle = (object.minAngle + (object.maxAngle - object.minAngle) / 2);
                x = object.pos.x + Math.cos(angle) * object.minSpeed * this.scale;
                y = object.pos.y - Math.sin(angle) * object.minSpeed * this.scale;
                this.dragHandlerMinSpeed.setPosition(x, y);
                x = object.pos.x + Math.cos(angle) * object.maxSpeed * this.scale;
                y = object.pos.y - Math.sin(angle) * object.maxSpeed * this.scale;
                this.dragHandlerMaxSpeed.setPosition(x, y);
            }
        }
    });

    pe.VelocityVariationWidget.Helper = me.Renderable.extend({
        init : function(color) {
            this.parent(new me.Vector2d(0, 0), 0, 0);
            this.color = color.toRGBA();
            this.angle = 0;
            this.angleVariation = 0;
            this.minSpeed = 0;
            this.maxSpeed = 0;
            this.wind = 0;
            this.gravity = 0;
            this.scale = 30;
            this.z = Infinity;
        },
        set : function(object) {
            this.pos.setV(object.pos);

            this.angle = (object.minAngle + (object.maxAngle - object.minAngle) / 2);
            this.angleVariation = Math.abs(object.maxAngle - object.minAngle) / 2;

            this.minSpeed = object.minSpeed;
            this.maxSpeed = object.maxSpeed;
            this.wind = object.wind;
            this.gravity = object.gravity;
        },
        draw : function(context, rect) {
            context.strokeStyle = this.color;
            context.fillStyle = this.color;
            context.beginPath();
            var x = this.pos.x, y = this.pos.y, startAngle = -(this.angle - this.angleVariation), endAngle = -(this.angle + this.angleVariation);
            var minRadius = this.minSpeed * this.scale, maxRadius = this.maxSpeed * this.scale;
            context.arc(x, y, maxRadius, startAngle, endAngle, true);
            if (minRadius < 0) {
                context.arc(x, y, -minRadius, endAngle + Math.PI, startAngle + Math.PI);
            } else {
                context.arc(x, y, minRadius, endAngle, startAngle);
            }
            context.closePath();
            context.fill();
            context.stroke();
        }
    });
})();