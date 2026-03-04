package pop;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import java.util.Calendar;
import java.util.Date;

import adapter.adap_SimpleNum_uno;

public class popCancelarAgregarPago_AP {


    Context context;
    adapter.adapterClientesPedidos adapterClientesPedidos;
    int posicion = -1;
    adap_SimpleNum_uno adap_SimpleNum_uno;
    private boolean estadoLiquidar = false;
    public void showPopupWindow(View view) {

        this.adapterClientesPedidos = adapterClientesPedidos;
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.popu_ap_agregar_pago, null);
        context = popupView.getContext();
        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;
        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        context = popupView.getContext();

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
    }

    public void returnSeleccion(int i){
        posicion = i;
    }
    private int caledario(int i){
        Date date = new Date();
        Calendar calendar = Calendar.getInstance();
        calendar.setFirstDayOfWeek( Calendar.MONDAY);
        calendar.setMinimalDaysInFirstWeek(4);
        calendar.setTime(date);
        return calendar.get(i);
    }
    private void initRecycler(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context));
    }
    void toast(String s){
        generales.toast(s, context); }


    private String notaCan(EditText notaCancelacion){
        if(notaCancelacion.length() > 0){
            return notaCancelacion.getText().toString();
        } else {
            return null;
        }
    }
    public static void  cerrarTeclado(View view, Context context){
        view.clearFocus();
        if (view != null) {
            InputMethodManager imm = (InputMethodManager)context.getSystemService(Context.INPUT_METHOD_SERVICE);
            imm.hideSoftInputFromWindow(view.getWindowToken(), 0);
        }
    }
}

/*

                    JSONArray jsonArray = new JSONArray();

                    int tam;
                    try {
                        tam = jsonPedido.getJSONObject(idAp).getJSONArray("pagos").length();

                        for (int i = 0; i < tam; i++){
                            jsonArray.put(jsonPedido.getJSONObject(idAp).getJSONArray("pagos").getString(i));
                        }

                        //JSONArray jsonArray = new JSONArray();
                        String restaCant = txtResta.getText().toString();
                        jsonArray.put(
                                restaCant
                                        + "&" +
                                        String.valueOf(caledario((Calendar.YEAR)))
                                        + "ç" +
                                        String.valueOf(caledario((Calendar.MONTH)) + 1)
                                        + "ç" +
                                        String.valueOf(caledario((Calendar.DAY_OF_MONTH)))
                                        + "ç" +
                                        String.valueOf(caledario((Calendar.WEEK_OF_YEAR)) + 1)
                                        + "ç" +
                                        String.valueOf(caledario((Calendar.DAY_OF_YEAR))));



                        jsonPedido.getJSONObject(idAp).
                                put("pagos", jsonArray);

                        final fire.getData getData = new getData();
                        getData.documenRef("/apartados/" + idAp).update(
                                new Gson().fromJson(jsonPedido.getJSONObject(idAp).toString(), HashMap.class));

                        ArrayList<String> arrayList = new ArrayList<>();
                        arrayList.add(
                                "Liquidacion apartado"   + "ç" + // nombre     0 1
                                        restaCant        + "ç" + // precios    1 2
                                        "00000000"       + "ç" + // id         2 3
                                        "null"           + "ç" + // imagen     3 4
                                        "1"              + "ç" + // exixtencia 4 5
                                        "0"              + "ç" + // ??         5 6
                                        "1"              + "ç" + // selec      6 7
                                        "apartado"       + "ç" + // SupGenero
                                        "null"           + "ç" + // SuBgenero
                                        "null"                   // hijo

                        );
                        pedidos.liquidarPedido(idAp, arrayList, restaCant);
                        pedidos.cancelarPedido(txtNumAp_masDeUno,id, "2", null);
                        pedidos.cambiarPosiciones(id);

                        popupWindow.dismiss();
                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
 */