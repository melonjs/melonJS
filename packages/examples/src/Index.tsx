import { Link } from "react-router-dom";

export const Index = () => {
	return (
		<>
			<ul>
				<li>
					<Link to="aseprite" reloadDocument>
						aseprite
					</Link>
				</li>
			</ul>
		</>
	);
};
