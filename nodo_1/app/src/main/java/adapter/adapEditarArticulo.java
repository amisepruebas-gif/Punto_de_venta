package adapter;

import static com.example.nodo_1.generales.toast;
import static com.example.nodo_1.principal.jsonDatos;
import static com.example.nodo_1.principal.jsonSiglas;
import static adapter.adapIngresoMercancia.generarCadenaUnica;

import android.app.Activity;
import android.content.Context;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.KeyEvent;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.constraintlayout.widget.ConstraintLayout;
import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.google.android.material.textfield.TextInputEditText;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;

import helper.SwipeHelper;
import pop.pop_selec_talla;

public class adapEditarArticulo extends RecyclerView.Adapter<adapEditarArticulo.ViewHolder> {

    JSONArray array = new JSONArray();
    Context context;
    JSONObject cambiSigla = new JSONObject();
    JSONObject nuevaSigla = new JSONObject();
    JSONObject objSiglas;

    Activity activity;

    public adapEditarArticulo(Context context, Activity activity){
        this.activity = activity;
        this.context = context;
        try {
            objSiglas = new JSONObject(jsonSiglas.toString());
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.ingreso_mercancia_recycler_reg_1, parent, false);
        ViewHolder viewHolder = new ViewHolder(view);
        return viewHolder;
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Button but = holder.but, butSiglaExistente = holder.butSiglaExistente;
        ConstraintLayout consModificar = holder.consMod;
        Button butMod = holder.butMod;
        TextInputEditText
                nombre          = holder.nombre,
                codigo          = holder.codigo,
                referencia      = holder.referencia,
                sigla           = holder.sigla,
                cantidad        = holder.cantidad,
                compra          = holder.compra,
                venta           = holder.venta,
                utilidad        = holder.utilidad,
                utilidadTotal   = holder.utilidadTotal,
                mayoreo         = holder.mayoreo,
                cantMayoreo     = holder.cantMayoreo;
        CheckBox
                checkBoxIndicarTalla = holder.checkBoxIndicarTalla, checkBoxIndicarSeña = holder.checkBoxIndicarSeña, check_2x1 = holder.check_2x1;
        CheckBox checkBox_descuento = holder.checkBox_descuento;
        EditText descuentoEdittext  = holder.descuentoEdittext;

        Button but_photoBarCode = holder.but_photoBarCode;

        butSiglaExistente.setVisibility(View.GONE);

        setupEditorActionListener(nombre,        holder);
        setupEditorActionListener(codigo,        holder);
        setupEditorActionListener(referencia,    holder);
        setupEditorActionListener(sigla,         holder);
        setupEditorActionListener(cantidad,      holder);
        setupEditorActionListener(compra,        holder);
        setupEditorActionListener(venta,         holder);
        setupEditorActionListener(utilidad,      holder);
        setupEditorActionListener(utilidadTotal, holder);
        setupEditorActionListener(mayoreo,       holder);
        setupEditorActionListener(cantMayoreo,   holder);
        setupEditorActionListener_EditText(descuentoEdittext,   holder);


        try {
            JSONObject obj = array.getJSONObject(position);

            if(!obj.has("m")){
                nombre.setEnabled(false);    referencia.setEnabled(false);
                cantidad.setEnabled(false);  compra.setEnabled(false);
                venta.setEnabled(false);     sigla.setEnabled(false);
                check_2x1.setEnabled(false); checkBoxIndicarSeña.setEnabled(false);
                checkBoxIndicarTalla.setEnabled(false);
                mayoreo.setEnabled(false);   cantMayoreo.setEnabled(false);
                descuentoEdittext.setEnabled(false); checkBox_descuento.setEnabled(false);
                consModificar.setVisibility(View.VISIBLE);
            }else {
                nombre.setEnabled(true);    referencia.setEnabled(true);
                cantidad.setEnabled(true);  compra.setEnabled(true);
                venta.setEnabled(true);     sigla.setEnabled(true);
                check_2x1.setEnabled(true); checkBoxIndicarSeña.setEnabled(true);
                checkBoxIndicarTalla.setEnabled(true);
                mayoreo.setEnabled(true);   cantMayoreo.setEnabled(true);
                descuentoEdittext.setEnabled(true); checkBox_descuento.setEnabled(true);
                consModificar.setVisibility(View.GONE);
            }
            but_photoBarCode.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    ((com.example.nodo_1.editar_articulos) activity).photoBarcode_adapter(holder.getAdapterPosition());
                }
            });

            butMod.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    nombre.setEnabled(true);    referencia.setEnabled(true);
                    cantidad.setEnabled(true);  compra.setEnabled(true);
                    venta.setEnabled(true);     sigla.setEnabled(true);
                    check_2x1.setEnabled(true); checkBoxIndicarSeña.setEnabled(true);
                    mayoreo.setEnabled(true);   cantMayoreo.setEnabled(true);
                    descuentoEdittext.setEnabled(true); checkBox_descuento.setEnabled(true);
                    checkBoxIndicarTalla.setEnabled(true);

                    try {
                        array.getJSONObject(holder.getAdapterPosition()).put("m", "");
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    consModificar.setVisibility(View.GONE);
                    notifyItemChanged(holder.getAdapterPosition());
                }
            });
            Button but_generarsigla = holder.but_generarsigla;
            but_generarsigla.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    ArrayList<String> arrayList = new ArrayList<>();
                    if(array.length() > 0){
                        for (int x = 0; x < array.length(); x++){
                            try {
                                if(array.getJSONObject(x).has("sigla")){
                                    arrayList.add(array.getJSONObject(x).getString("sigla"));
                                }
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    }
                    if(objSiglas.length() > 0){
                        for (int i = 0; i < objSiglas.names().length(); i++){
                            try {
                                arrayList.add(objSiglas.names().getString(i));
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                    }
                    String s = generarCadenaUnica(arrayList);
                    try {
                        array.getJSONObject(holder.getAdapterPosition()).put("sigla", s);
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }
                    if(sigla.length()>0) {
                        objSiglas.remove(sigla.getText().toString());
                    }
                    sigla.setText(s);
                }
            });
            sigla.addTextChangedListener(new TextWatcher() {
                @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
                @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
                @Override
                public void afterTextChanged(Editable editable) {
                    if(sigla.length() > 0){
                        String siglaIngresada = sigla.getText().toString();
                        boolean existeEnesteRegistro = false;
                        for (int x = 0; x < array.length(); x++){
                            try {
                                if(array.getJSONObject(x).has("sigla")){
                                    if(array.getJSONObject(x).getString("sigla").equals(siglaIngresada)){
                                        butSiglaExistente.setVisibility(View.VISIBLE);
                                        existeEnesteRegistro = true;
                                    }
                                }
                            } catch (JSONException e) {
                                throw new RuntimeException(e);
                            }
                        }
                        if(!existeEnesteRegistro){
                            if(objSiglas.length() > 0){
                                if(objSiglas.has(siglaIngresada)){
                                    existeEnesteRegistro = true;
                                    butSiglaExistente.setVisibility(View.VISIBLE);
                                }
                            }
                        }

                        try {
                            if(array.getJSONObject(holder.getAdapterPosition()).has("sigla")){
                                if(array.getJSONObject(holder.getAdapterPosition()).getString("sigla").equals(siglaIngresada))existeEnesteRegistro=false;
                            }
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                        if(!existeEnesteRegistro)butSiglaExistente.setVisibility(View.GONE);
                        //notifyItemChanged(holder.getAdapterPosition());
                    }else butSiglaExistente.setVisibility(View.GONE);
                }
            });
            but.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    try {
                        if (cantidad.length() > 0 && compra .length() > 0 && venta.length() > 0){
                            boolean estadoMaoreo = false;
                            if(mayoreo.length() > 0 || cantMayoreo.length() > 0){
                                if(mayoreo.length() > 0 && cantMayoreo.length() > 0){
                                }else  estadoMaoreo = true;
                            }
                            if(!estadoMaoreo){
                                int pos = holder.getAdapterPosition();
                                array.getJSONObject(holder.getAdapterPosition()).remove("m");

                                array.getJSONObject(pos).put("cantidad",    cantidad.getText().toString());
                                array.getJSONObject(pos).put("preciCompra", compra.getText().toString());
                                array.getJSONObject(pos).put("precioVenta", venta.getText().toString());
                                array.getJSONObject(pos).put("nombre",      nombre.getText().toString());
                                array.getJSONObject(pos).put("id",          codigo.getText().toString());

                                if(referencia.length() > 0) array.getJSONObject(pos).put("referencia", referencia.getText().toString());
                                else  array.getJSONObject(pos).put("referencia","");

                                if(sigla.length() > 0) array.getJSONObject(pos).put("sigla", sigla.getText().toString());
                                else {
                                    sigla.setText("");
                                }
                                if(check_2x1.isChecked()) array.getJSONObject(pos).put("2x1", "1");
                                else {
                                    if (array.getJSONObject(pos).has("2x1"))array.getJSONObject(pos).remove("2x2");
                                }
                                if(checkBoxIndicarSeña.isChecked())  array.getJSONObject(pos).put("seña", "");
                                else {
                                    if (array.getJSONObject(pos).has("seña"))array.getJSONObject(pos).remove("seña");
                                }
                                if(checkBoxIndicarTalla.isChecked());
                                else {
                                    if (array.getJSONObject(pos).has("tallas"))array.getJSONObject(pos).remove("tallas");
                                }
                                if(checkBox_descuento.isChecked()) array.getJSONObject(pos).put("descuento", descuentoEdittext.getText().toString());
                                else {
                                    if (array.getJSONObject(pos).has("descuento"))array.getJSONObject(pos).remove("descuento");
                                }
                                if(mayoreo.length() > 0){
                                    array.getJSONObject(pos).put("mayoreo"   , mayoreo.getText().toString());
                                }else  array.getJSONObject(pos).remove("mayoreo" );
                                if(cantMayoreo.length() > 0){
                                    array.getJSONObject(pos).put("cantMayoreo", cantMayoreo.getText().toString());
                                }else   array.getJSONObject(pos).remove("cantMayoreo");

                                nombre.setEnabled(false);    referencia.setEnabled(false);
                                cantidad.setEnabled(false);  compra.setEnabled(false);
                                venta.setEnabled(false);     sigla.setEnabled(false);
                                check_2x1.setEnabled(false); checkBoxIndicarSeña.setEnabled(false);
                                mayoreo.setEnabled(false);   cantMayoreo.setEnabled(false);
                                checkBox_descuento.setEnabled(false); descuentoEdittext.setEnabled(false);
                                checkBoxIndicarTalla.setEnabled(false);

                                consModificar.setVisibility(View.VISIBLE);
                                notifyItemChanged(pos);
                            }else {
                                toast("FALTA 1 CAMPO DE MAYOREO", context);
                            }

                        }
                    } catch (JSONException e) {
                        throw new RuntimeException(e);
                    }

                }
            });

            compra.addTextChangedListener(new TextWatcher() {
                @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
                @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
                @Override
                public void afterTextChanged(Editable editable) {
                    if(venta.length() >  0 && compra.length() > 0){
                        int utlUnitario = Integer.parseInt(venta.getText().toString()) - Integer.parseInt(compra.getText().toString());
                        utilidad.setText(String.valueOf(utlUnitario));
                        try {
                            array.getJSONObject(holder.getAdapterPosition()).put("utilidad", String.valueOf(utlUnitario));
                            if(cantidad.length() > 0){
                                String ultTotal = String.valueOf(Integer.parseInt(cantidad.getText().toString()) * utlUnitario);
                                utilidadTotal.setText(ultTotal);
                                array.getJSONObject(holder.getAdapterPosition()).put("utilidadTotal", ultTotal);
                            }else utilidadTotal.setText("");
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }else utilidad.setText("");
                }
            });
            venta.addTextChangedListener(new TextWatcher() {
                @Override public void beforeTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
                @Override public void onTextChanged(CharSequence charSequence, int i, int i1, int i2) {}
                @Override
                public void afterTextChanged(Editable editable) {
                    if(venta.length() >  0 && compra.length() > 0){
                        int utlUnitario = Integer.parseInt(venta.getText().toString()) - Integer.parseInt(compra.getText().toString());
                        utilidad.setText(String.valueOf(utlUnitario));
                        try {
                            array.getJSONObject(holder.getAdapterPosition()).put("utilidad", String.valueOf(utlUnitario));
                            if(cantidad.length() > 0){
                                String ultTotal = String.valueOf(Integer.parseInt(cantidad.getText().toString()) * utlUnitario);
                                utilidadTotal.setText(ultTotal);
                                array.getJSONObject(holder.getAdapterPosition()).put("utilidadTotal", ultTotal);
                            }else utilidadTotal.setText("");
                        } catch (JSONException e) {
                            throw new RuntimeException(e);
                        }
                    }else utilidad.setText("");
                }
            });
            String cant =           obj.getString("cantidad");
            String precioCompra =   obj.getString("preciCompra");
            String precioVenta  =   obj.getString("precioVenta");
            if(obj.has("nombre")) nombre.setText(obj.getString("nombre"));
            else nombre.setText("");
            codigo       .setText(obj.getString("id"));
            codigo       .setEnabled(false);

            if(obj.has("referencia")) referencia.setText(obj.getString("referencia"));
            else referencia.setText("");

            cantidad     .setText(cant);
            compra       .setText(precioCompra);
            venta        .setText(precioVenta);
            utilidad     .setText(obj.getString("utilidad"));
            utilidad.setEnabled(false);
            utilidadTotal.setText(obj.getString("utilidadTotal"));
            utilidadTotal.setEnabled(false);

            utilidad.setText(String.valueOf(Integer.parseInt(precioVenta) - Integer.parseInt(precioCompra)));
            int uno = Integer.parseInt(precioVenta) * Integer.parseInt(cant);
            int dos = Integer.parseInt(precioCompra)* Integer.parseInt(cant);
            utilidadTotal.setText(String.valueOf(uno - dos));

            if (obj.has("sigla"))       sigla.setText(obj.getString("sigla"));
            else sigla.setText("");
            if (obj.has("izq"))         check_2x1.setChecked(true);
            else check_2x1.setChecked(false);
            if (obj.has("seña"))        checkBoxIndicarSeña.setChecked(true);
            else checkBoxIndicarSeña.setChecked(false);
            if (obj.has("tallas"))       checkBoxIndicarTalla.setChecked(true);
            else checkBoxIndicarTalla.setChecked(false);
            if(obj.has("mayoreo"))      mayoreo.setText(obj.getString("mayoreo"));
            else mayoreo.setText("");
            if(obj.has("cantMayoreo"))  cantMayoreo.setText(obj.getString("cantMayoreo"));
            else cantMayoreo.setText("");
            if(obj.has("descuento"))    {
                descuentoEdittext.setText(obj.getString("descuento"));
                checkBox_descuento.setChecked(true);
            } else {
                descuentoEdittext.setText("");descuentoEdittext.setEnabled(false);
                checkBox_descuento.setChecked(false);
            }
            checkBoxIndicarTalla.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if (checkBoxIndicarTalla.isChecked()){
                        if(!jsonDatos.has("tallas")){
                            toast("AGREGUE 1 TALLA EN LA SECCIÓN, GESTOR DE OFERTAS", context);
                            checkBoxIndicarTalla.setChecked(false);
                        }else {
                            checkBoxTalla = checkBoxIndicarTalla;
                            pop.pop_selec_talla pop_selec_talla  = new pop_selec_talla();
                            pop_selec_talla.showPopupWindow(view, adapEditarArticulo.this, holder.getAdapterPosition(), "");
                        }
                    }
                }
            });
            checkBox_descuento.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View view) {
                    if(checkBox_descuento.isChecked()){
                        descuentoEdittext.setEnabled(true);
                    }else {
                        descuentoEdittext.setEnabled(false);
                        descuentoEdittext.setText("");
                    }
                }
            });
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    CheckBox checkBoxTalla;
    int indexTalla = -1;
    public void selecTallaEnPop(String apuntador_str, int index){
        try {
            array.getJSONObject(index).put("tallas", apuntador_str);
            indexTalla = index;
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    PopupWindow popupWindow;
    public void getPopupWindow_confirmar(PopupWindow popupWindow){this.popupWindow = popupWindow;}
    public void initPop_confirmar(){
        popupWindow.setOnDismissListener(new PopupWindow.OnDismissListener() {
            @Override
            public void onDismiss() {
                try {
                    if(indexTalla >= 0){
                        if(!array.getJSONObject(indexTalla).has("tallas")){
                            toast("NINGUNA TALLA ASIGNADA", context);checkBoxTalla.setChecked(false);
                        }
                    }else {
                        toast("NINGUNA TALLA ASIGNADA", context);checkBoxTalla.setChecked(false);
                    }
                    indexTalla = -1;
                } catch (JSONException e) {
                    throw new RuntimeException(e);
                }
            }
        });
    }

    public void actualizarLiga_photoScanner(int index, String s){
        try {
            array.getJSONObject(index).put("sigla", s);
            notifyItemChanged(index);
        } catch (JSONException e) {
            throw new RuntimeException(e);
        }
    }
    private void setupEditorActionListener(TextInputEditText editText, final ViewHolder holder) {
        editText.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_NEXT) {

                    // Simular un clic en el botón
                    holder.but.performClick();

                    return true; // Manejar el evento aquí
                }
                return false;
            }
        });
    }
    private void setupEditorActionListener_EditText(EditText editText, final ViewHolder holder) {
        editText.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                if (actionId == EditorInfo.IME_ACTION_NEXT) {

                    // Simular un clic en el botón
                    holder.but.performClick();

                    return true; // Manejar el evento aquí
                }
                return false;
            }
        });
    }



    SwipeHelper swipeHelper = null;
    public void swip(SwipeHelper swipeHelper){
        this.swipeHelper = swipeHelper;
    }
    public void add(JSONObject object) throws JSONException {
        boolean estadoEnEdicion = false;
        if(array.length() > 0){
            for (int i = 0; i < array.length(); i++){
                if(array.getJSONObject(i).has("m")){
                    estadoEnEdicion = true;
                }
            }
        }
        if (!estadoEnEdicion){
            array.put(object);
            notifyItemInserted(array.length()-1);
        }else toast("HAY UN ARTICULO EN EDICION", context);
    }
    public void remove(int index){
        array.remove(index);
        notifyItemRemoved(index);
    }
    public JSONArray getArray(){return  array;}
    @Override
    public int getItemCount() {
        return array.length();
    }
    public void reset(){
        array = new JSONArray();
        nuevaSigla = new JSONObject();
        cambiSigla = new JSONObject();
        notifyDataSetChanged();
    }
    public JSONObject getNuevaSigla(){return nuevaSigla;}
    public JSONObject getCambiSigla(){return cambiSigla;}

    public class ViewHolder extends RecyclerView.ViewHolder {


        Button but, butMod, butSiglaExistente, but_generarsigla, but_photoBarCode;
        TextInputEditText nombre, codigo, referencia, sigla, cantidad, compra, venta, utilidad, utilidadTotal,

        mayoreo, cantMayoreo;

        CheckBox checkBox_descuento;
        EditText descuentoEdittext;

        ConstraintLayout consMod;

        CheckBox checkBoxIndicarTalla, checkBoxIndicarSeña,check_2x1;

        public ViewHolder(@NonNull View itemView) {
            super(itemView);
            but = (Button) itemView.findViewById(R.id.butConfirmarRegIngMerc);
            butSiglaExistente = (Button)itemView.findViewById(R.id.butSiglaExistente);


            nombre          = (TextInputEditText) itemView.findViewById(R.id.inputEditText_NotaIndividual_Eqp_trabajo);
            codigo          = (TextInputEditText) itemView.findViewById(R.id.inputEditText_10);
            referencia      = (TextInputEditText) itemView.findViewById(R.id.inputEditText_9);
            sigla           = (TextInputEditText) itemView.findViewById(R.id.inputEditText_11);
            cantidad        = (TextInputEditText) itemView.findViewById(R.id.inputEditText_12);
            compra          = (TextInputEditText) itemView.findViewById(R.id.inputEditText_13);
            venta           = (TextInputEditText) itemView.findViewById(R.id.inputEditText_14);
            utilidad        = (TextInputEditText) itemView.findViewById(R.id.inputEditText_15);
            utilidadTotal   = (TextInputEditText) itemView.findViewById(R.id.inputEditText_16);
            butMod          = (Button) itemView.findViewById(R.id.butModificarregIngMerc);
            consMod         = (ConstraintLayout) itemView.findViewById(R.id.consModificarRegIngMerc);
            mayoreo         = (TextInputEditText) itemView.findViewById(R.id.textImputLayoutMayoreo);
            cantMayoreo     = (TextInputEditText) itemView.findViewById(R.id.inmputEditText_canMayoreo);


            checkBox_descuento   = (CheckBox) itemView.findViewById(R.id.checkBoxDescuento);
            checkBoxIndicarTalla = (CheckBox) itemView.findViewById(R.id.checkBoxIndicarTalla);
            checkBoxIndicarSeña  = (CheckBox) itemView.findViewById(R.id.checkBoxIndicarSeña);
            check_2x1            = (CheckBox) itemView.findViewById(R.id.checkBoxIndicarcheck_2x1);

            but_generarsigla = (Button) itemView.findViewById(R.id.butgenerarSiglaRegAdapter);
            but_photoBarCode = (Button) itemView.findViewById(R.id.but_photoBarCode);

            descuentoEdittext= (EditText) itemView.findViewById(R.id.editTextTextDescuento);

        }
    }
}
