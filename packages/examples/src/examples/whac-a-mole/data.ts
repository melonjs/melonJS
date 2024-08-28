// Add an index signature to the 'data' object
interface Data {
	[key: string]: number;
}

/**
 * local game data
 */
export const data: Data = {
	// score information
	score: 0 as number,
	hiscore: 0 as number,
};
