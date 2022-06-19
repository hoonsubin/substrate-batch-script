import ObjectsToCsv from 'objects-to-csv';
import fsPromise from 'fs/promises';
import * as fs from 'fs';
import csv from 'csv-parser';

/**
 * Saves the given list of object (must be 1 level deep) as a csv file in the given path.
 * @param list The object list that will be saved. The object shouldn't be nested or complex.
 * @param path The path to save the csv file. Defaults to `./list.csv`
 */
export const saveAsCsv = async (list: Array<any>, path: string = './list.csv') => {
    const csv = new ObjectsToCsv(list);

    await csv.toDisk(path);
};

export const saveAsJson = async (list: Array<any>, path: string = './list.json') => {
    const data = JSON.stringify(list);
    await fsPromise.writeFile(path, data);
};

export const readCsv = async <T>(filePath: string): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        const results: T[] = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('error', (err) => reject(err))
            .on('end', () => {
                resolve(results);
            });
    });
};

export const readJson = async <T>(filePath: string): Promise<T[]> => {
    return new Promise((resolve, reject) => {
        let results: T[] = [];
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            }
            
            try {
             results = JSON.parse(data.toString());
            } catch (e) {
                reject(e);
            }
            
            resolve(results);
        });
    });
};
