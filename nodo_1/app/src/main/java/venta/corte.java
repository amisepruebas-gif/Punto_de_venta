package venta;

import static com.example.nodo_1.generales.saveData_sharedPreferences;
import static com.example.nodo_1.generales.toast;
import static pop.pop_corte.key_corte;
import static pop.pop_corte.name_corte;

import android.content.Context;

import com.example.nodo_1.generales;

import org.json.JSONException;
import org.json.JSONObject;

import pop.pop_corte;

public class corte {
    public void init(Context context, String añoActual, String mesActual, String diaActual, String numeroDeVenta){
        /** CORTE **/
        String obj_str_corte = generales.loadData_sharedPreferences(context, key_corte, name_corte);
        try {
            if(!obj_str_corte.equals("")){
                JSONObject obj_corte = new JSONObject(obj_str_corte);
                if(obj_corte.getString("estado").equals(pop_corte.corte_iniciar)){
                    String idVenta_corte = añoActual + "-" + mesActual + "-" + diaActual + "-" + numeroDeVenta;
                    obj_corte.put("idVenta_corte", idVenta_corte);
                    obj_corte.put("estado", pop_corte.corte_enCurso);
                    saveData_sharedPreferences(context, name_corte, key_corte, obj_corte.toString());
                }
            }
        }catch (JSONException e){
            toast("error corte init", context);
        }
        /** -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- **/
    }
}
