package modulos_descarga;

import static com.example.nodo_1.generales.actualizarDatosGuardados;
import static com.example.nodo_1.generales.loadData_sharedPreferences;
import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonSiglas;

import static descarga_init.descarga.mapToJSON;

import android.content.Context;

import androidx.annotation.NonNull;

import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.example.nodo_1.principal;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Objects;

import descarga_init.descarga;


public class articulos {

    Context context;
    public articulos(Context context){
        this.context = context;
    }
    int              tamArticulos            = 0;
    private String   huellaArticulos         = "";
    JSONObject       provicional_DescArt     = new JSONObject();
    public void escucharArticulosEnDatos(JSONObject object, principal principal){
        try {
            if (object.has("huella")){
                huellaArticulos = object.getString("huella");
            }
        } catch (JSONException ex) {
            throw new RuntimeException(ex);
        }
        object.remove("huella");
        JSONArray articulosCapArray = new JSONArray();
        JSONArray namesConcluidos = new JSONArray();
        String idDispositivo = loadData_sharedPreferences(context, "id_mensaje", "dispositivo");
        for (int i = 0; i < object.names().length(); i++){
            try {
                JSONArray array = object.getJSONArray(object.names().getString(i));
                boolean estadoTrue = false;
                for (int x = 0; x < array.length(); x++){
                    if(array.getJSONObject(x).names().getString(0).equals(idDispositivo)){
                        if(!array.getJSONObject(x).getBoolean(idDispositivo)){
                            articulosCapArray.put(object.names().getString(i));
                            object.getJSONArray(object.names().getString(i)).getJSONObject(x).put(idDispositivo, true);
                        }
                    }else{
                        if(!array.getJSONObject(x).getBoolean(array.getJSONObject(x).names().getString(0))){
                            estadoTrue = true;
                        }
                    }
                }
                if(!estadoTrue){
                    namesConcluidos.put(object.names().getString(i));
                }
            } catch (JSONException ex) {
                throw new RuntimeException(ex);
            }
        }
        if (articulosCapArray.length() > 0){

            tamArticulos = articulosCapArray.length();
            for (int i = 0; i < articulosCapArray.length(); i++){
                FirebaseFirestore db = FirebaseFirestore.getInstance();
                try {
                    int finalI = i;
                    db.collection(context.getString(R.string.articulos_n) + "/").document(articulosCapArray.getString(i))
                            .get()
                            .addOnSuccessListener(new OnSuccessListener<DocumentSnapshot>() {
                                @Override
                                public void onSuccess(DocumentSnapshot documentSnapshot) {
                                    if (documentSnapshot.exists()) {
                                        try {
                                            tamArticulos--;
                                            JSONObject objArticulos = mapToJSON(Objects.requireNonNull(documentSnapshot.getData()));
                                            provicional_DescArt.put(articulosCapArray.getString(finalI),objArticulos);


                                            if(tamArticulos == 0){

                                                if(namesConcluidos.length() == object.names().length()){

                                                    descarga.unavezArt = false;

                                                    fire.documenRef("datos/" + context.getString(R.string.articulos_ac)).delete().addOnSuccessListener(new OnSuccessListener<Void>() {
                                                        @Override
                                                        public void onSuccess(Void unused) {
                                                            jsonDatos.remove("articulos_ac");
                                                            for (int x = 0; x < provicional_DescArt.names().length(); x++){
                                                                try {
                                                                    jsonArticulos.put(provicional_DescArt.names().getString(x),
                                                                            provicional_DescArt.getJSONObject(provicional_DescArt.names().getString(x)));
                                                                } catch (JSONException e) {
                                                                    throw new RuntimeException(e);
                                                                }
                                                            }
                                                            actualizarDatosGuardados("jsonArticulos" , jsonArticulos .toString(), context);
                                                            actualizarDatosGuardados("jsonDatos" , jsonDatos .toString(), context);
                                                            provicional_DescArt = new JSONObject();
                                                            initArticulos();
                                                        }
                                                    }).addOnFailureListener(new OnFailureListener() {
                                                        @Override
                                                        public void onFailure(@NonNull Exception e) {

                                                        }
                                                    });
                                                }else {
                                                    if(namesConcluidos.length() > 0){
                                                        for (int i = 0; i < namesConcluidos.length(); i++){
                                                            object.remove(namesConcluidos.getString(i));
                                                        }
                                                    }
                                                    object.put("huella", huellaArticulos);
                                                    fire.documenRef("datos/" + "articulos_ac").
                                                            set(new Gson().fromJson(
                                                                    object.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener<Void>() {
                                                                @Override
                                                                public void onSuccess(Void unused) {
                                                                    try {
                                                                        for (int x = 0; x < provicional_DescArt.names().length(); x++){
                                                                            jsonArticulos.put(provicional_DescArt.names().getString(x),
                                                                                    provicional_DescArt.getJSONObject(provicional_DescArt.names().getString(x)));
                                                                        }
                                                                        jsonDatos.put("articulos_ac", object);
                                                                        provicional_DescArt = new JSONObject();
                                                                        actualizarDatosGuardados("jsonArticulos" , jsonArticulos.toString(), context);
                                                                        actualizarDatosGuardados("jsonDatos" , jsonDatos .toString(), context);
                                                                        initArticulos();
                                                                        principal.actualizarAutocomplete();
                                                                    } catch (
                                                                            JSONException ex) {
                                                                        throw new RuntimeException(ex);
                                                                    }
                                                                }
                                                            });
                                                }
                                            }
                                        } catch (JSONException ex) {
                                            throw new RuntimeException(ex);
                                        }
                                    } else {

                                    }
                                }
                            })
                            .addOnFailureListener(new OnFailureListener() {
                                @Override
                                public void onFailure(@NonNull Exception e) {
                                    toast("venta no encontrada");
                                }
                            });
                } catch (JSONException ex) {
                    toast("Error");
                    throw new RuntimeException(ex);
                }
            }
        }else {
            principal.actualizarAutocomplete();
        }
    }
    private void initArticulos(){
        for (int i = 0; i < jsonArticulos.names().length(); i++){
            try {
                if(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).has("sigla")){
                    JSONObject object = new JSONObject();
                    object.put("id", jsonArticulos.names().getString(i));
                    jsonSiglas.put(jsonArticulos.getJSONObject(jsonArticulos.names().getString(i)).getString("sigla"), object);
                }
            } catch (JSONException e) {
                throw new RuntimeException(e);
            }
        }
        actualizarDatosGuardados("jsonArticulos", jsonArticulos.toString(), context);
    }
    private void toast(String s){
        generales.toast(s, context);
    }
}
