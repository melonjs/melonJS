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
                return;
            }
            var object = this._getNestedObject(), propertyName = this.propertyName;
            if (object[propertyName] !== value) {
                object[propertyName] = value;
                me.event.publish("propertyChanged", [ this.object ]);
            }
        },
    });

    pe.WidgetBase = Object.extend({
        init : function(propertyName) {
            this.property = new pe.PropertyWrapper(propertyName);
            this.rootNode = null;
        },
        getRootNode : function() {
            if (!this.rootNode) {
                this.rootNode = document.createElement("div");
            }
            return this.rootNode;
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

    pe.FloatInputWidget = pe.WidgetBase.extend({
        init : function(propertyName) {
            this.parent(propertyName);

            var root = this.getRootNode();
            var label = document.createElement("label");
            var input = this.input = document.createElement("input");
            input.setAttribute("type", "number");
            input.setAttribute("step", "any");
            input.addEventListener("change", this.onChange.bind(this));
            label.appendChild(document.createTextNode(propertyName))
            label.appendChild(input)
            root.appendChild(label);
        },
        onChange : function() {
            if (this.input.validity.valid) {
                this.property.setValue(this.input.value);
            }
        },
        sync : function() {
            this.input.value = this.property.getValue();
        }
    });

    pe.IntegerInputWidget = pe.WidgetBase.extend({
        init : function(propertyName) {
            this.parent(propertyName);

            var root = this.getRootNode();
            var label = document.createElement("label");
            var input = this.input = document.createElement("input");
            input.setAttribute("type", "number");
            input.setAttribute("step", "1");
            input.addEventListener("change", this.onChange.bind(this));
            label.appendChild(document.createTextNode(propertyName))
            label.appendChild(input)
            root.appendChild(label);
        },
        onChange : function() {
            if (this.input.validity.valid) {
                this.property.setValue(this.input.value);
            }
        },
        sync : function() {
            this.input.value = this.property.getValue();
        }
    });

    pe.TextInputWidget = pe.WidgetBase.extend({
        init : function(propertyName) {
            this.parent(propertyName);

            var root = this.getRootNode();
            var label = document.createElement("label");
            var input = this.input = document.createElement("input");
            input.setAttribute("type", "text");
            input.addEventListener("change", this.onChange.bind(this));
            label.appendChild(document.createTextNode(propertyName))
            label.appendChild(input)
            root.appendChild(label);
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

            var root = this.getRootNode();
            var label = document.createElement("label");
            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            label.appendChild(document.createTextNode(propertyName))
            label.appendChild(input)
            root.appendChild(label);
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

            var root = this.getRootNode();
            var label = document.createElement("label");
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
            label.appendChild(document.createTextNode(propertyName))
            label.appendChild(select)
            root.appendChild(label);
        },
        onChange : function() {
            var image = me.loader.getImage(this.select.value);
            this.property.setValue(image);
        },
        sync : function() {
            var image = this.property.getValue();
            if (image) {
                resourceList = this.resourceList;
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

            this.shape = new pe.ShapeWidget.Helper("#f00");
            this.dragHandler = new pe.DragHandler("#f00", "rgba(255, 0, 0, 0.3)");
            this.dragHandler.onDrag = this.onDrag.bind(this);

            var root = this.getRootNode();
            var label = document.createElement("label");
            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            label.appendChild(document.createTextNode("toggle shape widget"));
            label.appendChild(input);
            root.appendChild(label);
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
        sync : function() {
            var object = this.object;
            if (object) {
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
            this.parent(context, this.color);
        }
    });

    pe.DragHandler = me.Renderable.extend({
        init : function(color) {
            this.color = color;
            this.originalSize = 40;
            this.parent(new me.Vector2d(0, 0), this.originalSize, this.originalSize);
            this.z = Infinity;
            this.dragging = false;
            this.grabOffset = new me.Vector2d(0, 0);
            this.floating = true;

            this._startDrag = this.startDrag.bind(this);
            this._stopDrag = this.stopDrag.bind(this);
            this._drag = this.drag.bind(this);
        },
        enable : function(container) {
            me.input.registerPointerEvent("mousedown", this, this._startDrag);
            me.input.registerPointerEvent("mouseup", me.game.viewport, this._stopDrag);
            me.input.registerPointerEvent("mousemove", me.game.viewport, this._drag);
            (container || me.game.world).addChild(this);
        },
        disable : function(container) {
            me.input.releasePointerEvent("mousedown", this, this._startDrag);
            me.input.releasePointerEvent("mouseup", me.game.viewport, this._stopDrag);
            me.input.releasePointerEvent("mousemove", me.game.viewport, this._drag);
            (container || this.ancestor || me.game.world).removeChild(this);
        },
        setPosition : function(x, y) {
            this.pos.set(x - this.hWidth, y - this.hHeight);
        },
        startDrag : function(event) {
            this.dragging = true;

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
            context.strokeStyle = this.color;
            context.fillStyle = this.color;
            context.beginPath();
            context.arc(this.pos.x + this.hWidth, this.pos.y + this.hHeight, this.hWidth, 0, Math.PI * 2);
            context.stroke();
            context.globalAlpha = 0.3;
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

            var root = this.getRootNode();
            var label = document.createElement("label");
            var input = this.input = document.createElement("input");
            input.setAttribute("type", "checkbox");
            input.addEventListener("change", this.onChange.bind(this));
            label.appendChild(document.createTextNode("toggle " + name + " widget"));
            label.appendChild(input);
            root.appendChild(label);
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
        sync : function() {
            var object = this.object;
            if (object) {
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
            this.color = color;
        },
        setAngle : function(angle) {
            var length = this.vector.length();
            this.vector.set(Math.cos(angle) * length, -Math.sin(angle) * length);
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
            context.strokeStyle = this.color;
            context.translate(origin.x, origin.y);
            context.moveTo(0, 0);
            context.lineTo(vector.x, vector.y);
            context.stroke();
            context.restore();
        }
    });
})();