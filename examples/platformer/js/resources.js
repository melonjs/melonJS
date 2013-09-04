game.resources = [

	/* Graphics. 
	 * @example
	 * {name: "example", type:"image", src: "data/img/example.png"},
	 */
	{name: "tileset",		type:"image",	src: "data/img/tileset.png"},
	{name: "atascii",		type:"image",	src: "data/img/atascii_24px.png"},
	{name: "background",	type:"image",	src: "data/img/background.png"},	
	
		
	/* Maps. 
	 * @example
	 * {name: "example01", type: "tmx", src: "data/map/example01.tmx"},
	 * {name: "example01", type: "tmx", src: "data/map/example01.json"},
 	 */
	{name: "map1",			type: "tmx",	src: "data/map/map1.tmx"},
	{name: "map2",			type: "tmx",	src: "data/map/map2.tmx"},


	/* Background music. 
	 * @example
	 * {name: "example_bgm", type: "audio", src: "data/bgm/", channel : 1},
	 */	
	{name: "DST-GameForest",type: "audio",	src: "data/bgm/",	channel : 1},
	
	/* Sound effects. 
	 * @example
	 * {name: "example_sfx", type: "audio", src: "data/sfx/", channel : 2}
	 */
	{name: "cling",			type: "audio",	src: "data/sfx/",	channel : 2},
	{name: "die",			type: "audio",	src: "data/sfx/",	channel : 1},
	{name: "enemykill",		type: "audio",	src: "data/sfx/",	channel : 1},
	{name: "jump",			type: "audio",	src: "data/sfx/",	channel : 2},

	
	/* Atlases 
	 * @example
	 * {name: "example_tps", type: "json", src: "data/img/example_tps.json"},
	 */
	// texturePacker
	{name: "texture",		type: "json",	src: "data/img/texture.json"},
	{name: "texture",		type: "image",	src: "data/img/texture.png"}
	// ShoeBox
	//{name: "texture",		type: "json",	src: "data/gfx/shoebox.json"},
	//{name: "texture",		type:"image",	src: "data/gfx/shoebox.png"}
	 
];
