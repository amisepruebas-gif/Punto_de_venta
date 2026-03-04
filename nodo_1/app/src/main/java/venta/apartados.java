package venta;

import static com.example.nodo_1.principal.jsonClientes;
import static com.example.nodo_1.principal.jsonPedido;

import static pase_de_lista.actializarCliente.actualizaCliente_init;
import static pase_de_lista.actualizarApartado.actualizaApartado_init;

import android.content.Context;

import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import pase_de_lista.actializarCliente;
import pase_de_lista.actualizarApartado;

public class apartados {
    public void init(JSONObject objDatosApartado,JSONObject objDatosCliente, adapter.adapRegVenta adapRegVenta, Context context){
        try {
            boolean u_ap = false;
            JSONArray array = new JSONArray(adapRegVenta.getArray().toString());
            JSONArray array_uno = new JSONArray();
            for (int i = 0; i < array.length(); i++){
                if(array.getJSONObject(i).has("numeroAp")){
                    u_ap = true;
                    if(objDatosApartado.has("nuevocl")){
                        JSONArray arrayAp = objDatosApartado.getJSONArray("articulos");
                        for (int x = 0; x < arrayAp.length(); x++){
                            JSONObject object = new JSONObject();
                            object.put("id", arrayAp.getJSONObject(x).getString("id"));
                            object.put("cantidad", arrayAp.getJSONObject(x).getString("cantidad"));
                            array_uno.put(object);
                        }
                    }
                }
            }
            if (u_ap){
                if (!objDatosApartado.has("nuevocl") && !objDatosApartado.has("abono")) {
                    objDatosApartado.remove("nuevoap");

                    /**--------------------------------------------------------------------------------**/
                    fire.documenRef("apartados/" + objDatosApartado.getString("numAp")).
                            set(new Gson().fromJson(
                                    objDatosApartado.toString(), HashMap.class));
                    actualizaApartado_init(objDatosApartado.getString("numAp"), context);

                    jsonPedido  .put(objDatosApartado.getString("numAp"),        objDatosApartado);

                    jsonClientes.getJSONObject(objDatosApartado.getString("cliente")).put("ultimoApartado", objDatosApartado.getString("numAp"));
                    jsonClientes.getJSONObject(objDatosApartado.getString("cliente")).put("listaAp", objDatosCliente.getJSONArray("listaAp"));


                   /**--------------------------------------------------------------------------------**/
                    fire.documenRef("cliente/"  +  objDatosApartado.getString("cliente")).
                            update(new Gson().fromJson(
                                    jsonClientes.getJSONObject(objDatosApartado.getString("cliente")).toString(), HashMap.class));
                    actualizaCliente_init(objDatosApartado.getString("cliente"), context);

                }else if (objDatosApartado.has("nuevocl")){

                    objDatosApartado.remove("nuevocl");
                    objDatosApartado.remove("nuevoap");

                    /**--------------------------------------------------------------------------------**/
                    fire.documenRef("apartados/" + objDatosApartado.getString("numAp")).
                            set(new Gson().fromJson(
                                    objDatosApartado.toString(), HashMap.class));
                    actualizaApartado_init(objDatosApartado.getString("numAp"), context);

                    /**--------------------------------------------------------------------------------**/
                    fire.documenRef("cliente/"  +  objDatosCliente.getString("numeroCliente")).
                            set(new Gson().fromJson(
                                    objDatosCliente.toString(), HashMap.class));
                    actualizaCliente_init(objDatosApartado.getString("cliente"), context);

                    jsonPedido  .put( objDatosApartado.getString("numAp"),        objDatosApartado);
                    jsonClientes.put( objDatosCliente.getString("numeroCliente"), objDatosCliente);

                }else if (objDatosApartado.has("abono")){

                    objDatosApartado.remove("abono");
                    String idApartado = objDatosApartado.getString("numAp");
                    JSONObject object = new JSONObject();
                    object.put("cantidad",objDatosApartado.getString("cantidad"));
                    object.put("fecha",objDatosApartado.getString("fecha"));
                    object.put("resta",objDatosApartado.getString("resta"));
                    jsonPedido.getJSONObject(idApartado).getJSONArray("abonos").put(new JSONObject(object.toString()));
                    jsonPedido.getJSONObject(idApartado).put("status", objDatosApartado.getString("status"));

                    /**--------------------------------------------------------------------------------**/
                    fire.documenRef("apartados/" + objDatosApartado.getString("numAp")).
                            update(new Gson().fromJson(
                                    jsonPedido.getJSONObject(objDatosApartado.getString("numAp")).toString(), HashMap.class));
                    actualizaApartado_init(objDatosApartado.getString("numAp"), context);
                }
                for (int i = 0; i < array_uno.length(); i++){
                    array.put(array_uno.getJSONObject(i));
                }
                array.remove(0);
            }
        }catch (JSONException e){
            generales.toast("ERROR INIT AP", context);
        }
    }
}
