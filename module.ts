import fs from "fs";
import path from "path";
import { Module, ModuleManager } from "../../API/Modules/Module";
import { UserBaseManager } from "../official-base-authentication/classes/UserBase";
import { RoleBasedUserController } from "./classes/RoleBasedUser";

class BaseModule extends Module
{
    constructor()
    {
        super("Authentication - Role-Based", fs.readFileSync(path.resolve(__dirname, "./version.txt")).toString("utf-8"));

        UserBaseManager.RegisterUserBase(new RoleBasedUserController()); // We want this to run after all modules are loaded.
    }
}

ModuleManager.RegisterModule(new BaseModule());