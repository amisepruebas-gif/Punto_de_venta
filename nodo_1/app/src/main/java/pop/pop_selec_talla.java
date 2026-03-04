package pop;


import static com.example.nodo_1.generales.recyclerVertical;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;

import android.os.Handler;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.airbnb.lottie.LottieAnimationView;
import com.example.nodo_1.R;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.Task;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import adapter.adapEditarArticulo;
import adapter.adapIngresoMercancia;
import adapter.adap_selec_talla;
import pase_de_lista.actualizarArticulo_paseDeLista;

public class pop_selec_talla {
    String apuntador_str = "";
    adapter.adap_selec_talla adapSelecTalla;
    String id_articulo;
    public void showPopupWindow(final View view, RecyclerView.Adapter adapter, int index, String nameVistaArticulos) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.selec_talla, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        RecyclerView recyclerView = (RecyclerView)popupView.findViewById(R.id.recycler_selec_talla_vista_principal);
        recyclerVertical(recyclerView, popupView.getContext());
        adapSelecTalla = new adap_selec_talla(popupView.getContext(), pop_selec_talla.this, nameVistaArticulos);
        recyclerView.setAdapter(adapSelecTalla);

        Button button = (Button) popupView.findViewById(R.id.but_selec_talla_pop);
        if(nameVistaArticulos.equals("")){
            if (adapter.getClass().getSimpleName().equals("adapIngresoMercancia")){
                ((adapIngresoMercancia)adapter).getPopupWindow_confirmar(popupWindow);
                ((adapIngresoMercancia)adapter).initPop_confirmar();
            }else if (adapter.getClass().getSimpleName().equals("adapEditarArticulo")){
                ((adapEditarArticulo)adapter).getPopupWindow_confirmar(popupWindow);
                ((adapEditarArticulo)adapter).initPop_confirmar();
            }

            button.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if (apuntador_str.length() > 0) {
                        if (adapter.getClass().getSimpleName().equals("adapIngresoMercancia")){
                            ((adapIngresoMercancia)adapter).selecTallaEnPop(apuntador_str, index);
                        } else if (adapter.getClass().getSimpleName().equals("adapEditarArticulo")){
                            ((adapEditarArticulo)adapter).selecTallaEnPop(apuntador_str, index);
                        }
                        popupWindow.dismiss();
                    }
                    else toast("SELECCIONAR UN GRUPO", popupView.getContext());
                }
            });
        }else {
            LottieAnimationView  animation_check_1 = popupView.findViewById(R.id.animation_view);
            animation_check_1.setVisibility(View.GONE);
            id_articulo = ((adapter.adapVistaArticulos)adapter).getId();
            button.setText("EDITAR");
            button.setBackground(popupView.getContext().getDrawable(R.drawable.medio_red_azul_datos_segmento));
            button.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if (!unavez){
                        unavez = true;
                        button.setBackground(popupView.getContext().getDrawable(R.drawable.medio_red_rojo_suave));
                        button.setText("SUBIR CAMBIOS");
                        adapSelecTalla.habilitarEdicion();
                    }else {
                        if(!apuntador_str.equals("")){
                            try {
                                JSONObject jsnProv = new JSONObject(jsonArticulos.getJSONObject(id_articulo).toString());
                                jsnProv.put("tallas", apuntador_str);
                                fire.documenRef("articulosUno/" + id_articulo).
                                        set(new Gson().fromJson(jsnProv.toString(), HashMap.class)).addOnCompleteListener(new OnCompleteListener() {
                                            @Override
                                            public void onComplete(@NonNull Task task) {
                                                try {
                                                    jsonArticulos.put(id_articulo, jsnProv);
                                                    generales.actualizarDatosGuardados("jsonArticulos", jsonArticulos.toString(), popupView.getContext());
                                                    cont--;
                                                    actualizarArticulo_paseDeLista.actualizaArticulos(id_articulo, popupView.getContext(), cont);
                                                } catch (JSONException e) {
                                                    throw new RuntimeException(e);
                                                }
                                                if (cont == 0){
                                                    animation_check_1.setVisibility(View.VISIBLE);
                                                    animation_check_1.playAnimation();
                                                    new Handler().postDelayed(() -> {
                                                        animation_check_1.pauseAnimation(); // Detiene la animación
                                                        animation_check_1.setVisibility(View.GONE);
                                                        if (adapter.getClass().getSimpleName().equals("adapVistaArticulos")){
                                                            ((adapter.adapVistaArticulos)adapter).actualiza(id_articulo, index);
                                                        }
                                                        popupWindow.dismiss();
                                                    }, 2000);
                                                }
                                            }
                                        }).addOnFailureListener(new OnFailureListener() {
                                            @Override
                                            public void onFailure(@NonNull Exception e) {
                                                toast("PROBLEMA AL ACTUALIZAR", popupView.getContext());
                                            }
                                        });
                            }catch (JSONException e){

                            }
                        }
                    }
                }
            });
        }
    }
    int cont = 1;
    boolean unavez = false;
    public void selec_object(String apuntador){
        apuntador_str = apuntador;
    }
    public void reset_selec(){
        apuntador_str = "";
    }
}
