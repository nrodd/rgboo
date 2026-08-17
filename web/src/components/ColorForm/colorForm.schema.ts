import { number, object, string} from 'yup';
import { Profanity } from '@2toad/profanity';

const twitch_user_req = /^[a-zA-Z0-9_\s]+$/;
const special_chars = /[\s_]/;

const profanity = new Profanity({
    wholeWord: false
});
profanity.whitelist.addWords(['test']);

export const colorFormSchema = object({
    username: string()
        .required('Required')
        .min(4, 'Too short!')
        .max(25, 'Too long!')
        .matches(
            twitch_user_req,
            'Username can only contain alphanumeric characters'
        )
        .test(
            'is-clean',
            'Username contains inappropriate language',
            (value) => !profanity.exists(value.replace(special_chars,''))
        ),
    color: object({
        r: number().required().min(0).max(255),
        g: number().required().min(0).max(255),
        b: number().required().min(0).max(255),
    }).required()
});