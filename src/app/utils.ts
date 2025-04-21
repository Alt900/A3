import { Injectable } from '@angular/core';
@Injectable({
    providedIn: 'root'
})

export class Utils{
    static async FetchRoute(route:string):Promise<any>{
        const response = await fetch(`/api/${route}`);
        let data = await response.json()
        data = data.payload
        return data
    }
}