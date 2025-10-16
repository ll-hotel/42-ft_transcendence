export default interface AppPage {
	loadInto(container: HTMLElement): void;
	unload(): void;
};
