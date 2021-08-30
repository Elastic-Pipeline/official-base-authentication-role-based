import { DataStore, DataStoreObject, DataStoreParameter, DataStoreTableVariable } from "../../official-base-authentication/classes/DataStore";
import { UserBaseController, UserBaseManager } from "../../official-base-authentication/classes/UserBase";
import { BasicUser } from "../../official-base-authentication/classes/Usage/BasicUserBase";
import { final } from "../../../API/Common/FinalDecoration";
import { Logger } from "../../../API/Common/Logging";

@final
export class Permission
{
    private name: string = "";
    private description: string = "";
    constructor(_name: string, _description: string = "")
    {
        this.name = _name;
        this.description = _description;
    }
    public GetName() : string
    {
        return this.name;
    }
    public GetDescription() : string
    {
        return this.description;
    }

    public toString() : string
    {
        return `${this.name}`;
    }
}

export const USER_MANAGEMENT            = new Permission("USER_MANAGEMENT");
export const USER_MANAGEMENT_ACC_ADD    = new Permission("USER_MANAGEMENT.ACCOUNT.ADD");
export const USER_MANAGEMENT_ACC_VIEW   = new Permission("USER_MANAGEMENT.ACCOUNT.VIEW");
export const USER_MANAGEMENT_ACC_EDIT   = new Permission("USER_MANAGEMENT.ACCOUNT.EDIT");
export const USER_MANAGEMENT_ACC_DEL    = new Permission("USER_MANAGEMENT.ACCOUNT.DELETE");
export const USER_MANAGEMENT_ACC_ROLES  = new Permission("USER_MANAGEMENT.ACCOUNT.ROLES");

@final
export class Role implements DataStoreObject
{
    id: number = -1;
    private name: string = "";
    private permissions: Permission[] = [];

    constructor(_name: string, _permissions: Permission[]|string = [])
    {
        this.name = _name;
        if (typeof _permissions === 'string')
        {
            const parsed = JSON.parse(_permissions);
            console.log(parsed);
            if (Array.isArray(parsed))
            {
                const parsedPermissions: Permission[] = [];
                for (let index = 0; index < parsed.length; index++)
                {
                    const element = parsed[index];
                    parsedPermissions.push(new Permission(element))
                }
                this.permissions = parsedPermissions;
            }
        }
        else
        {
            this.permissions = _permissions;
        }
    }

    public SetId(_id: number): void
    {
        this.id = _id;
    }

    public GetId(): number
    {
        return this.id;
    }

    public GetName()
    {
        return this.name;
    }

    public GetPermissions() : Permission[]
    {
        return this.permissions;
    }

    public async Commit(): Promise<boolean>
    {
        var success = false;
        if (this.GetId() == -1)
        {
            success = await DataStore.InsertToTable("users_roles",
                new DataStoreParameter("name", this.GetName()),
                new DataStoreParameter("permissions", this.GetPermissions())
            );

            this.SetId(await DataStore.GetLastInsertID("users_roles"));
        }
        else
        {
            success = await DataStore.UpdateTable("users_roles", [`\`ID\`=${this.GetId()}`], new DataStoreParameter("permissions", this.GetPermissions()));
        }

        return success;
    }
    public async Destroy(): Promise<boolean>
    {
        const beforeID = this.GetId();
        if (beforeID == -1)
            return false;
        this.SetId(-1); // We destroyed it.
        return await DataStore.RemoveRowFromTable("users_roles", [`\`ID\`=${beforeID}`]);
    }
}

// A lot of the functions are being used at super class.
export class RoleBasedUser extends BasicUser
{
    private roles: Role[] = [];

    constructor()
    {
        super();
    }

    private async loadRoles(): Promise<void>
    {
        const sqlRoles = await DataStore.FetchFromTable("users_roles_relations", ['role_id', 'usr_id'], [`\`usr_id\`=${this.GetId()}`]);
        for (let index = 0; index < sqlRoles.length; index++) {
            const roleData = sqlRoles[index];
            const roleId = roleData['role_id'];
            const sqlRoleData = await DataStore.FetchFromTable("users_roles", ['*'], [`\`id\`=${roleId}`]);
            const role = new Role(sqlRoleData[0]['name'], sqlRoleData[0]['permissions']);
            role.SetId(roleId);
            this.AddRole(role);
        }
    }

    public async LoginById(_id: number): Promise<boolean>
    {
        const success = super.LoginById(_id);
        if (!success)
            return false;

        this.loadRoles();
        console.log("Login User by Id : ", this.GetUsername(), this.GetId());

        return true;
    }
    public async Login(_accessIdentifier: string, _password: string): Promise<boolean>
    {
        const success = super.Login(_accessIdentifier, _password);
        if (!success)
            return false;

        this.loadRoles();
        console.log("Login User : ", this.GetUsername());

        return true;
    }

    public AddRole(_role: Role) : void
    {
        this.roles.push(_role);
    }

    public GetRoles() : Role[]
    {
        return this.roles;
    }

    public async Destroy() : Promise<boolean>
    {
        for (let index = 0; index < this.roles.length; index++) {
            const role = this.roles[index];
            console.log([`\`usr_id\`=${this.GetId()}`, `\'role_id\'=${role.GetId()}`]);
            await DataStore.RemoveRowFromTable("users_roles_relations", [`\`usr_id\`=${this.GetId()}`, `\`role_id\`=${role.GetId()}`]);
        }
        var success = await super.Destroy();

        return success;
    }

    public async Commit(): Promise<boolean>
    {
        var success = await super.Commit();

        if (!success)
            return false; // Don't continue when it already failed.

        for (let index = 0; index < this.roles.length; index++)
        {
            const role = this.roles[index];
            await role.Commit();

            success = await DataStore.InsertToTable("users_roles_relations",
                new DataStoreParameter("role_id", role.GetId()),
                new DataStoreParameter("usr_id", this.GetId())
            );

            if (!success)
            {
                Logger.error("Role Based User couldn't insert role: ", role);
                break;
            }
        }


        return success;
    }
}

export class RoleBasedUserController extends UserBaseController
{
    constructor()
    {
        super(RoleBasedUser);
    }
    private async TestBench()
    {
        console.log("Role Based User Controller TestBench!");
        const adminRole = new Role("admin", [
            USER_MANAGEMENT,
            USER_MANAGEMENT_ACC_ADD,
            USER_MANAGEMENT_ACC_VIEW,
            USER_MANAGEMENT_ACC_DEL,
            USER_MANAGEMENT_ACC_EDIT,
            USER_MANAGEMENT_ACC_ROLES
        ]);

        const testUser = (await UserBaseManager.GetUserId(1) || UserBaseManager.NewUser()) as RoleBasedUser;
        testUser.SetUsername("test");
        testUser.SetPassword("test");
        testUser.SetEmail("test@email.com");
        testUser.AddRole(adminRole);
        await testUser.Commit();
        await testUser.Destroy();
        testUser.SetUsername("test");
        testUser.SetPassword("test");
        await testUser.Commit();


        const users = await DataStore.FetchFromTable("users", ['*']);
        console.log(users);
    }

    public async Initialize() : Promise<void>
    {
        await DataStore.DeleteTable("users");
        await DataStore.CreateTable("users",
            new DataStoreTableVariable("id", "INTEGER", { PRIMARY_KEY: true, AUTO_INCREMENT: true, NOT_NULL: true }),
            new DataStoreTableVariable("username", "VARCHAR(35)", { NOT_NULL: true }),
            new DataStoreTableVariable("password", "VARCHAR(512)", { NOT_NULL: true }),
            new DataStoreTableVariable("email", "VARCHAR(64)", { NOT_NULL: true }),
            new DataStoreTableVariable("creationDate", "TIMESTAMP", { DEFAULT: "CURRENT_TIMESTAMP", NOT_NULL: true })
        );
        await DataStore.DeleteTable("users_roles");
        await DataStore.CreateTable("users_roles",
            new DataStoreTableVariable("id", "INTEGER", { PRIMARY_KEY: true, AUTO_INCREMENT: true, NOT_NULL: true }),
            new DataStoreTableVariable("name", "VARCHAR(35)", { NOT_NULL: true }),
            new DataStoreTableVariable("permissions", "TEXT", { NOT_NULL: true }),
        );
        await DataStore.DeleteTable("users_roles_relations");
        await DataStore.CreateTable("users_roles_relations",
            new DataStoreTableVariable("usr_id", "INTEGER", { NOT_NULL: true }),
            new DataStoreTableVariable("role_id", "INTEGER", { NOT_NULL: true }),
        );

        this.TestBench();
    }
}