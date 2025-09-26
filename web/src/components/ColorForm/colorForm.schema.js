import { number, object, string} from 'yup';

const twitch_user_req = /^[a-zA-Z0-9_]+$/;

export const colorFormSchema = object({
    username: string()
        .required('Required')
        .min(4, 'Too short!')
        .max(25, 'Too long!')
        .matches(
            twitch_user_req,
            'Username can only contain alphanumeric characters'
        ),
    color: object({
        r: number().required().min(0).max(255),
        g: number().required().min(0).max(255),
        b: number().required().min(0).max(255),
    }).required()
});