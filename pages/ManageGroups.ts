import { ConfigurationBasePage } from "../../official-configuration-page/classes/ConfigurationPage";

export module Configuration
{
    export class ManageGroups extends ConfigurationBasePage
    {
        constructor()
        {
            super("Manage Groups", "manage/groups", false);
            this.SetDescription("Modify/Add/Remove Groups.");
        }
    }
}