package pop;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonDatos;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.admin;
import com.example.nodo_1.fire;
import com.example.nodo_1.generales;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.gson.Gson;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;

import adapter.adpRegNomCorte;
import descarga_init.descarga;

public class popAgergarNomCorte {

    public void showPopupWindow(final View view, admin admin) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_nombre_corte_agregar_editar, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        RecyclerView recyclerView = (RecyclerView) popupView.findViewById(R.id.recyclerRegNomEditarCorte);
        generales.recyclerVertical(recyclerView, popupView.getContext());
        adpRegNomCorte adpRegNomCorte = new adpRegNomCorte();
        recyclerView.setAdapter(adpRegNomCorte);

        EditText editText = (EditText) popupView.findViewById(R.id.editTextPopAgregarnomCorte);
        Button butAgregar = (Button) popupView.findViewById(R.id.butAgregarNomRegCorte);
        Button butLimpiarEditText = (Button) popupView.findViewById(R.id.x_borrarCampoPopVarVenta2);
        Button butFinalizar = (Button)popupView.findViewById(R.id.finalizarNomagregarCorte);

        butAgregar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(editText.length() > 0){
                    adpRegNomCorte.agregar(editText.getText().toString());
                    editText.setText("");
                }
            }
        });
        butLimpiarEditText.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                editText.setText("");
            }
        });
        butFinalizar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                try {
                    if(adpRegNomCorte.getArray().length() > 0){
                        JSONObject object = new JSONObject();
                        object.put("nombresCorte", adpRegNomCorte.getArray());
                        fire.documenRef("datos/" + "nombresCorte").set(new Gson().fromJson(
                                object.toString(), HashMap.class)).addOnSuccessListener(new OnSuccessListener() {
                            @Override
                            public void onSuccess(Object o) {
                                try {
                                    descarga.escucharNombreCorte = false;
                                    JSONObject obj = new JSONObject();
                                    obj.put("nombresCorte", adpRegNomCorte.getArray());
                                    jsonDatos.put("nombresCorte", obj);
                                    generales.actualizarDatosGuardados("jsonDatos", jsonDatos.toString(), popupView.getContext());
                                    toast("POR CONFIRMAR", popupView.getContext());
                                } catch (JSONException e) {
                                    throw new RuntimeException(e);
                                }
                            }
                        }).addOnFailureListener(new OnFailureListener() {
                            @Override
                            public void onFailure(@NonNull Exception e) {
                                toast("ERROR", popupView.getContext());
                            }
                        });
                    }else {
                        toast("ALMENOS DEBE HABER 1 NOMBRE", popupView.getContext());
                    }

                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
    }
}
