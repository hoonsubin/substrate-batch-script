/**
 * Returns a list of splitted lists based on the chunk.
 * @param listInput The list that should be splitted.
 * @param chunk The number of chunks per list.
 * @returns A list of lists that is splitted based on the chunk.
 */
export const splitListIntoChunks = <T>(listInput: T[], chunk: number) => {
    // shallow copy of the list
    const list = listInput.map(x => x);

    const listChunks = [];

    const chunks = Math.ceil(list.length / chunk);

    for (let i = 0; i < chunks; i++) {
        // corner case
        if (list.length === 0)
            break;
        listChunks.push(list.splice(0, chunk));
    }

    return listChunks;
}