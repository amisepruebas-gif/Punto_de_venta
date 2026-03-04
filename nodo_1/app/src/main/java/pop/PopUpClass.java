package pop;

import static com.example.nodo_1.pedidos.editarAp;
import static com.example.nodo_1.pedidos.numeroRegArray;
import static com.example.nodo_1.pedidos.statusRegActivosInac;
import static com.example.nodo_1.principal.jsonPedido;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.pedidos;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import adapter.adap_reciclerEditAp;
public class PopUpClass {

    //PopupWindow display method
    String id, estado;
    public PopUpClass(String id, String estado){
        this.id = id;
        this.estado = estado;
    }

    public void showPopupWindow(final View view) {
        //Create a View object yourself through inflater
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        View popupView = inflater.inflate(R.layout.poput, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
        ConstraintLayout consRecyclerPoPu_uno = popupView.findViewById(R.id.consRecyclerPoPu_uno);
        Button buttonEdit = popupView.findViewById(R.id.button8);
        TextView textViewEscalonPoPuUno = popupView.findViewById(R.id.textViewEscalonPoPuUno);


        if(Integer.parseInt(statusRegActivosInac.split("ç")[0]) > 1){
            textViewEscalonPoPuUno.setVisibility(View.GONE);
            pedidos.editarAp = "cancelarRegistro";
            RecyclerView recyclerPopuUno = (RecyclerView)popupView.findViewById(R.id.recyclerPopuUno);
            initRecycler(recyclerPopuUno, popupView.getContext());
            List<String> l_ = new ArrayList<String>(); for(int u = 0; u < numeroRegArray.size(); u++)
            {
                if(numeroRegArray.get(u).equals("1")){
                    l_.add(String.valueOf(u+1));
                }
            }
            editarAp = estado;
            adap_reciclerEditAp adap_reciclerEditAp =
                    new adap_reciclerEditAp(
                            l_,
                            popupView.getContext(),
                            null,
                            null,
                            null,
                            null,
                            null,
                            popupWindow,
                            ""
                    );
            recyclerPopuUno.setAdapter(adap_reciclerEditAp);
            buttonEdit.setVisibility(View.GONE);

        }else {
            textViewEscalonPoPuUno.setVisibility(View.VISIBLE);
            consRecyclerPoPu_uno.setVisibility(View.GONE);
            //Initialize the elements of our window, install the handler
            buttonEdit.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    //As an example, display the message
                    Map<String, Object> map_estado = new HashMap<>();
                    String k = "";
                    try {
                        for(int x = 0; x < numeroRegArray.size(); x++){
                            if(!numeroRegArray.get(x).equals(String.valueOf("0"))){
                                k = String.valueOf(x+1);
                                x = numeroRegArray.size();
                            }
                        }
                        jsonPedido.getJSONObject(id).put("estado",false);
                        jsonPedido.getJSONObject(id).getJSONObject("pedidos").getJSONObject(k).put("estado", estado);

                        map_estado.put("pedidos",
                                new Gson().fromJson(jsonPedido.getJSONObject(id).getJSONObject("pedidos").toString(),
                                        HashMap.class));


                        com.example.nodo_1.fire.documenRef("/apartados/" + id).update(map_estado);



                        Map<String, Object> pagos = new HashMap<>();
                        Map<String, Object> pedidos = new HashMap<>();
                        int INDICADOR = Integer.parseInt(k);
                        int tamComp = jsonPedido.getJSONObject(id).getJSONObject("pagos").names().length();
                        int indice = 0;
                        Map<String, Object> map_A = new HashMap<>();
                        //indicador 1  tamComp 4
                        for(int x = 1; x <= tamComp; x++)    {
                            if(x ==INDICADOR){
                                if(INDICADOR != tamComp){
                                    indice = 1;
                                }
                            }
                            if(x == tamComp){
                                pagos.put(String.valueOf(x),
                                        new Gson().fromJson(
                                                jsonPedido.getJSONObject(id)
                                                        .getJSONObject("pagos").
                                                        getJSONObject(String.valueOf(INDICADOR)).toString(), HashMap.class));
                                pedidos.put(
                                        String.valueOf(x),
                                        new Gson().fromJson(
                                                jsonPedido.getJSONObject(id).
                                                        getJSONObject("pedidos").
                                                        getJSONObject(String.valueOf(INDICADOR)).toString()
                                                , HashMap.class));
                            }else {
                                pagos.put(
                                        String.valueOf(x),
                                        new Gson().fromJson(
                                                jsonPedido.getJSONObject(id)
                                                        .getJSONObject("pagos").
                                                        getJSONObject(String.valueOf(x + indice)).toString(), HashMap.class));
                                pedidos.put(
                                        String.valueOf(x),
                                        new Gson().fromJson(
                                                jsonPedido.getJSONObject(id)
                                                        .getJSONObject("pedidos").
                                                        getJSONObject(String.valueOf(x + indice)).toString(), HashMap.class));
                            }
                        }

                        map_A.put("pedidos", pedidos);
                        map_A.put("pagos",   pagos);
                        jsonPedido.getJSONObject(id).put("pedidos", new JSONObject(pedidos));
                        jsonPedido.getJSONObject(id).put("pagos", new JSONObject(pagos));
                        ////////////////////////////////////////////////////////////////////////////////////
                        com.example.nodo_1.fire.documenRef("/apartados/" + id).update(map_A);

                        popupWindow.dismiss();
                    } catch (JSONException e) {
                        e.printStackTrace();
                    }
                }
            });

        }

        //Handler for clicking on the inactive zone of the window

        popupView.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {

                //Close the window when clicked
                popupWindow.dismiss();
                return true;
            }
        });
    }
    private void initRecycler(RecyclerView recyclerView, Context context){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new LinearLayoutManager(context));
    }

}
/*
for(int x = 1; x <= tamComp; x++)    {
                        if(x ==INDICADOR){
                            if(INDICADOR != tamComp){
                                indice = 1;
                            }
                        }
                        if(x == tamComp){
                            pagos.put(
                                    String.valueOf(x), b_);
                            pedidos.put(
                                    String.valueOf(x),
                                    new Gson().fromJson(
                                            jsonPedido.getJSONObject(adapterClientesPedidos.getId()).
                                                    getJSONObject("pedidos").
                                                    getJSONObject(String.valueOf(INDICADOR)).toString()
                                            , HashMap.class));
                        }else {
                            pagos.put(
                                    String.valueOf(x),
                                    new Gson().fromJson(
                                            jsonPedido.getJSONObject(adapterClientesPedidos.getId())
                                                    .getJSONObject("pagos").
                                                    getJSONObject(String.valueOf(x + indice)).toString(), HashMap.class));
                            pedidos.put(
                                    String.valueOf(x),
                                    new Gson().fromJson(
                                            jsonPedido.getJSONObject(adapterClientesPedidos.getId())
                                                    .getJSONObject("pedidos").
                                                    getJSONObject(String.valueOf(x + indice)).toString(), HashMap.class));
                        }
                    }
 */