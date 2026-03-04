package pop;

import static com.example.nodo_1.fire.documenRef;
import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonArticulos;

import android.content.Context;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.admin;
import com.google.android.gms.tasks.OnCompleteListener;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.Task;
import com.google.gson.Gson;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.HashMap;

import adapter.adapter3x2;

public class pop3x2 {
    Context context;
    int cont = 0;
    public void showPopupWindow(final View view, admin admin) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop3x2, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
        context = popupView.getContext();

        RecyclerView recyclerView = (RecyclerView) popupView.findViewById(R.id.recyclerPop3x2);
        initRecyclerC(recyclerView);
        adapter3x2 adapter3x2 = new adapter3x2();
        recyclerView.setAdapter(adapter3x2);



        Button but_pop_3x2 = (Button) popupView.findViewById(R.id.but_pop_3x2);
        but_pop_3x2.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                JSONArray array =  adapter3x2.getArray();
                for (int i = 0; i < array.length(); i++){
                    try {
                        if(array.getJSONObject(i).has("nuevo") || array.getJSONObject(i).has("remove")){
                            cont++;
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
                for (int i = 0; i < array.length(); i++){
                    try {
                        if(array.getJSONObject(i).has("nuevo") || array.getJSONObject(i).has("remove")){
                            String id = array.getJSONObject(i).getString("id");
                            if(array.getJSONObject(i).has("nuevo"))jsonArticulos.getJSONObject(id).put("3x2","1");
                            else jsonArticulos.getJSONObject(id).remove("3x2");

                            documenRef("articulosUno/"+ id).
                                    set(new Gson().fromJson(jsonArticulos.getJSONObject(id).toString(), HashMap.class)).addOnCompleteListener(new OnCompleteListener() {
                                        @Override
                                        public void onComplete(@NonNull Task task) {
                                            cont--;
                                            if (cont == 0){
                                                toast("DATOS ACTUALIZADOS", popupView.getContext());
                                            }
                                        }
                                    }).addOnFailureListener(new OnFailureListener() {
                                        @Override
                                        public void onFailure(@NonNull Exception e) {
                                            toast("PROBLEMA AL ACTUALIZAR", popupView.getContext());
                                        }
                                    });
                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                }
            }
        });
    }

    private void initRecyclerC(RecyclerView recyclerView){
        recyclerView.setHasFixedSize(true);
        recyclerView.setLayoutManager(new GridLayoutManager(context, 3));
    }
}
