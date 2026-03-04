package com.example.nodo_1;

import static com.example.nodo_1.fire.documenRef;
import static com.example.nodo_1.principal.jsonDatos;

import android.content.Context;

import androidx.annotation.Nullable;

import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestoreException;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;

public class cargaUsuarios {
    Context context;
    public cargaUsuarios(Context context){
        this.context = context;
    }
    public void escuchar_uno(){
        DocumentReference docRef = documenRef("/datos/dispositivos_mensaje");

        docRef.addSnapshotListener(new EventListener<DocumentSnapshot>() {
            @Override
            public void onEvent(@Nullable DocumentSnapshot documentSnapshot, @Nullable FirebaseFirestoreException e) {
                try {
                    JSONObject jsnDatos_descarga = new JSONObject();
                    boolean estado = false;
                    for (String key : documentSnapshot.getData().keySet()) {
                        try {
                            jsnDatos_descarga.put(key, documentSnapshot.get(key));
                            if(!jsonDatos.getJSONObject("dispositivos_mensaje").has(key)){
                                estado = true;
                            }
                        } catch (JSONException e_) {
                            e_.printStackTrace();
                        }
                    }
                    if(!estado){
                        jsonDatos.put("dispositivos_mensaje",jsnDatos_descarga);
                        actualizarDatosGuardados("jsonDatos", jsonDatos.toString());
                        generales.toast("ESCUCHAR USUARIOS_INIT", context);
                    }
                } catch (JSONException ex) {
                    throw new RuntimeException(ex);
                }
            }
        });
    }
    public void actualizarDatosGuardados(String nameJson, String userString){
        File file = new File(context.getFilesDir(),nameJson);
        FileWriter fileWriter = null;
        try {
            fileWriter = new FileWriter(file);
            BufferedWriter bufferedWriter = new BufferedWriter(fileWriter);
            bufferedWriter.write(userString);
            bufferedWriter.close();
            // toast("datos guardados");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
