/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { find, mergeMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from './models/user';
import { Product } from '../products/models/product.interface';
var aws = require('aws-sdk')


@Injectable({
  providedIn: 'root',
})
export class UsersService {
  apiUrl: string;

  constructor(private http: HttpClient) {
    this.apiUrl = `${environment.apiUrl}/users`;
  }

  fetch(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  get(email: string): Observable<User> {
    return this.fetch().pipe(
      mergeMap((users) => users),
      find((u) => u.email === email)
    );
  }

  // create(user: User): Observable<User> {
  //   // this.run_data();
  //   var baseUrl = `./api/products`;
  //   return this.http.post<User>(baseUrl, user);
  //   //return this.http.post<User>(this.apiUrl, user);
  // }
  
  
  create(user: User): Observable<Product> {
    // this.run_data();
    var baseUrl = `./api/products`;
    return this.http.post<Product>(baseUrl, "test");
    //return this.http.post<User>(this.apiUrl, user);
  }

  update(email: string, user: User) {}
  
  
  
}
