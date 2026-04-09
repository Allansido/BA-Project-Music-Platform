import { User } from "./types";

const users: User[] = [];

export function findUserByEmail(email: string): User | undefined {
    return users.find(
        (user) => user.email.toLowerCase() === email.toLowerCase()
    );
}

export function findUserById(id: string): User | undefined {
    return users.find((user) => user.id === id);
}

export function createUser(user: User): User {
    users.push(user);
    return user;
}

export function getAllUsers(): User[] {
    return users;
}