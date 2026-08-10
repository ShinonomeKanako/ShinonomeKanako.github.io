const PINNED_TAG = "pinned";

export function hasPinnedTag(tags: string[] = []) {
	return tags.includes(PINNED_TAG);
}

export function getDisplayTags(tags: string[] = []) {
	return tags.filter((tag) => tag !== PINNED_TAG);
}
