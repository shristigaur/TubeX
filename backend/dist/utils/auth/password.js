import bcrypt from 'bcryptjs';
const SALT_ROUNDS = 12;
export const hashPassword = async (password) => {
    if (!password || password.trim() === '') {
        throw new Error('Password cannot be empty');
    }
    return bcrypt.hash(password, SALT_ROUNDS);
};
export const verifyPassword = async (password, passwordHash) => {
    if (!password || !passwordHash) {
        return false;
    }
    return bcrypt.compare(password, passwordHash);
};
//# sourceMappingURL=password.js.map