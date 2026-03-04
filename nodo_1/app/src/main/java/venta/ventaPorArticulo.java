package venta;

import static com.example.nodo_1.principal.jsonArticulos;
import static com.example.nodo_1.principal.jsonVentaXarticulo;

import static pase_de_lista.actualizarArt_X_venta.actualizaArticulos_x_venta;
import static pase_de_lista.actualizarArticulo_paseDeLista.actualizaArticulos;

import android.content.Context;

import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

public class ventaPorArticulo {
    public void init(Context context, JSONArray array, String numeroDeVenta, String año, String mes, String dia){
        JSONObject objVentaX_articulo = new JSONObject();
        try {
            int index = array.length();
            for (int x = 0; x < array.length(); x++){
                if(array.getJSONObject(x).has("id")){
                    if(!array.getJSONObject(x).getString("id").equals("00000000")){
                        String id = array.getJSONObject(x).getString("id");
                        String id_x_articulo = id;
                        int total = Integer.parseInt(
                                jsonArticulos.
                                        getJSONObject(id).getString("cantidad")) -
                                Integer.parseInt(array.getJSONObject(x).getString("cantidad"));
                        jsonArticulos.
                                getJSONObject(id).
                                put("cantidad", String.valueOf(total));

                        if(objVentaX_articulo.length() > 0){
                            if(objVentaX_articulo.has(id_x_articulo)){
                                objVentaX_articulo.getJSONArray(id_x_articulo).put(numeroDeVenta+"-"+String.valueOf(x));
                            }else {
                                JSONArray array1 = new JSONArray();
                                array1.put(numeroDeVenta+"-"+String.valueOf(x));
                                objVentaX_articulo.put(id_x_articulo, array1);
                            }
                        }else {
                            JSONArray array1 = new JSONArray();

                            array1.put(numeroDeVenta+"-"+String.valueOf(x));
                            objVentaX_articulo.put(id_x_articulo, array1);
                        }
                        fire.documenRef("articulos_n/"+ id).update(
                                new Gson().fromJson( jsonArticulos.getJSONObject(id).toString(), HashMap.class));

                        index--;
                        actualizaArticulos(id, context, index);
                    }
                }
            }

        }catch (JSONException e){
            generales.toast("error x articulo 1", context);
        }
        try {
            String fecha = año + "-" + mes + "-" + dia;

            if(jsonVentaXarticulo.length() > 0){
                if(objVentaX_articulo.length() > 0){
                    int y = objVentaX_articulo.length();
                    for (int i = 0; i < objVentaX_articulo.names().length(); i++){
                        y--;
                        String id = objVentaX_articulo.names().getString(i);
                        if(jsonVentaXarticulo.has(id)){

                            if(jsonVentaXarticulo.getJSONObject(id).has(fecha)){
                                JSONArray ar = jsonVentaXarticulo.getJSONObject(id).getJSONObject(fecha).getJSONArray("index");
                                for (int x = 0; x < objVentaX_articulo.getJSONArray(id).length(); x++){
                                    ar.put(objVentaX_articulo.getJSONArray(id).getString(x));
                                }
                            }else {
                                JSONObject object = new JSONObject();
                                object.put("index", objVentaX_articulo.getJSONArray(id));
                                jsonVentaXarticulo.getJSONObject(id).put(fecha, object);
                            }
                        }else {
                            JSONObject obj = new JSONObject();
                            JSONObject object = new JSONObject();
                            object.put("index", objVentaX_articulo.getJSONArray(id));
                            obj.put(fecha, object);

                            jsonVentaXarticulo.put(id, obj);
                        }
                        fire.documenRef("ventaArticulo/" + id).
                                set(new Gson().fromJson(
                                        jsonVentaXarticulo.getJSONObject(id).toString(), HashMap.class));
                        actualizaArticulos_x_venta(id, context, y);
                    }
                }
            }else {
                if(objVentaX_articulo.length() > 0){
                    int y = objVentaX_articulo.length();
                    for (int i = 0; i < objVentaX_articulo.names().length(); i++){
                        String id = objVentaX_articulo.names().getString(i);
                        JSONObject obj = new JSONObject();
                        JSONObject object = new JSONObject();
                        object.put("index", objVentaX_articulo.getJSONArray(id));
                        obj.put(fecha, object);

                        jsonVentaXarticulo.put(id, obj);

                        fire.documenRef("ventaArticulo/" + id).
                                set(new Gson().fromJson(
                                        jsonVentaXarticulo.getJSONObject(id).toString(), HashMap.class));
                        actualizaArticulos_x_venta(id, context, y);
                    }
                }
            }
        }catch (JSONException e){
            generales.toast("error x articulo 2", context);
        }
    }
}
