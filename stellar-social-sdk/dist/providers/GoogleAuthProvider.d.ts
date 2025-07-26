import { AuthMethod } from '../types/index.js';
export declare class GoogleAuthProvider {
    private clientId?;
    constructor(clientId?: string);
    initialize(): Promise<void>;
    authenticate(): Promise<AuthMethod>;
    verifyToken(token: string): Promise<any>;
    generateSeed(googleId: string): string;
}
