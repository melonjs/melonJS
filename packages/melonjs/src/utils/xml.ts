// DOM Node type constants
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/**
 * Normalizer callback type for {@link xmlToObject}.
 * Called for each child element node during XML-to-object conversion.
 * @param obj - the parent object being built
 * @param child - the child XML element to process
 * @param parse - recursive parser (calls xmlToObject with the same normalizer)
 */
export type XMLNormalizer = (
	obj: Record<string, unknown>,
	child: Element,
	parse: (node: Element) => Record<string, unknown>,
) => void;

/**
 * Convert an XML element tree into a plain JS object.
 *
 * - Element attributes become string properties
 * - Text nodes are concatenated (trimmed) into a `text` property
 * - Child elements are processed by the optional `normalizer` callback;
 *   without one, each child is recursively converted using its `nodeName` as key
 *
 * @param element - XML element to convert
 * @param normalizer - optional callback to handle child elements
 * @returns plain object representation of the XML element
 */
export function xmlToObject(
	element: Element,
	normalizer?: XMLNormalizer,
): Record<string, unknown> {
	const obj: Record<string, unknown> = {};

	// only Element nodes (nodeType 1) have attributes; Document nodes (nodeType 9) do not
	if (element.nodeType === ELEMENT_NODE) {
		const attributes = element.attributes;
		for (let i = 0, len = attributes.length; i < len; i++) {
			const attr = attributes[i];
			obj[attr.name] = attr.value;
		}
	}

	// only allocate the closure when a normalizer needs it
	const parse = normalizer
		? (node: Element) => xmlToObject(node, normalizer)
		: undefined;

	let text = "";

	const children = element.childNodes;
	for (let i = 0, len = children.length; i < len; i++) {
		const node = children[i];
		if (node.nodeType === ELEMENT_NODE) {
			if (parse) {
				normalizer!(obj, node as Element, parse);
			} else {
				obj[(node as Element).nodeName] = xmlToObject(node as Element);
			}
		} else if (node.nodeType === TEXT_NODE) {
			text += node.nodeValue!.trim();
		}
	}

	if (text) {
		obj.text = text;
	}

	return obj;
}
