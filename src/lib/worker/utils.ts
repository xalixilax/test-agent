interface LogMessage {
	type: "log";
	payload: {
		cssClass: string;
		args: string[];
	};
}

export const logHtml = (cssClass: string, ...args: string[]): void => {
	postMessage({
		type: "log",
		payload: { cssClass, args },
	} as LogMessage);
};

export const log = (...args: string[]): void => logHtml("", ...args);
export const error = (...args: string[]): void => logHtml("error", ...args);
