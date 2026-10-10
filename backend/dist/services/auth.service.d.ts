export declare const createUser: (name: string, email: string, passwordPlain: string) => Promise<{
    createdAt: Date;
    email: string;
    id: string;
    name: string;
    role: import("@prisma/client").$Enums.Role;
    updatedAt: Date;
}>;
//# sourceMappingURL=auth.service.d.ts.map