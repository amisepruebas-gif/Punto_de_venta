package com.example.nodo_1;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.firebase.firestore.CollectionReference;
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.FirebaseFirestore;

public class fire {

    private static String negocioId = null;

    public static FirebaseFirestore db(){
        return FirebaseFirestore.getInstance();
    }

    public static void setNegocioId(String id) {
        negocioId = id;
    }

    public static String getNegocioId() {
        return negocioId;
    }

    public static CollectionReference colRef(String collectionName) {
        return db().collection(collectionName);
    }

    public static DocumentReference documenRef(String refDoc){
        return db().document(refDoc);
    }

    public static void saveNegocioId(Context context, String id) {
        negocioId = id;
        SharedPreferences prefs = context.getSharedPreferences("fire_prefs", Context.MODE_PRIVATE);
        prefs.edit().putString("negocioId", id).apply();
    }

    public static String restoreNegocioId(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("fire_prefs", Context.MODE_PRIVATE);
        negocioId = prefs.getString("negocioId", null);
        return negocioId;
    }

    public static void clearNegocioId(Context context) {
        negocioId = null;
        SharedPreferences prefs = context.getSharedPreferences("fire_prefs", Context.MODE_PRIVATE);
        prefs.edit().remove("negocioId").apply();
    }
}
