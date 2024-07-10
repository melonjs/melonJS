import { game } from "melonjs";
import { useEffect } from "react";

export const createExampleComponent = (createGameFn: () => void) => {
	return () => {
		useEffect(() => {
			if (!game.isInitialized) {
				createGameFn();
			}
		}, [createGameFn]);
		return null;
	};
};
