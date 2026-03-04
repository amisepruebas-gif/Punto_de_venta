package com.example.nodo_1;

import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;

public class fire {

    public static FirebaseFirestore db(){
        return FirebaseFirestore.getInstance();
    }

    public static DocumentReference documenRef(String refDoc){
        DocumentReference document = db().document(refDoc);
        return document;
    }
}
