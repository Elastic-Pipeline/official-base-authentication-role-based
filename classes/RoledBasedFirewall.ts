import { Application, Request, Response } from "express";
import { RouteManager } from "../../../API/Routing/RouteManager";
import { Route } from "../../../API/Routing/Routing";
import { FirewallBase } from "../../official-base-authentication/classes/FirewallBase";
import { UserBaseManager } from "../../official-base-authentication/classes/UserBase";

export class BasicFirewall extends FirewallBase
{
    constructor()
    {
        super();
        this.On('enter', async (_app : Application, req : Request, res : Response) => {
            const url = Route.SanitizeURL(req.url);

            const whitelistedURLs = [RouteManager.GetRouteLabel('license'), RouteManager.GetRouteLabel('register')];
            const loginURL = RouteManager.GetRouteLabel('login');

            const usr = await UserBaseManager.GetUser(req);

            var loggedOut = false;
            if (usr == undefined)
            {
                loggedOut = true;
                UserBaseManager.Logout(req, res);
            }
            else
            {
                _app.locals.user = usr;
            }

            if (loggedOut && (url != loginURL && !url.startsWith('/static') && !url.endsWith("favicon.ico") && !whitelistedURLs.includes(url)))
            {
                return res.redirect(loginURL);
            }
        });
    }
}