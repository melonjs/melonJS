export default save;
declare namespace save {
    /**
     * Add new keys to localStorage and set them to the given default values if they do not exist
     * @name add
     * @memberof save
     * @param {object} props - key and corresponding values
     * @example
     * // Initialize "score" and "lives" with default values
     * me.save.add({ score : 0, lives : 3 });
     * // get or set the value through me.save
     * me.save.score = 1000;
     */
    function add(props: object): void;
    /**
     * Remove a key from localStorage
     * @name remove
     * @memberof save
     * @param {string} key - key to be removed
     * @example
     * // Remove the "score" key from localStorage
     * me.save.remove("score");
     */
    function remove(key: string): void;
}
