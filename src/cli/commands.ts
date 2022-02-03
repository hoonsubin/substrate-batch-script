
import { ParserConfiguration } from 'dashdash';

export const defaultOptions: ParserConfiguration['options'] = [
    {
        group: 'Tool Information',
    },
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'Print this help and exit.',
    },
];